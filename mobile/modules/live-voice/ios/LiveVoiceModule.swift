import AVFoundation
import ExpoModulesCore

private let playbackRate: Double = 24_000

struct LiveVoiceStatus: Record {
  @Field var sampleRate: Double = 0
  @Field var voiceProcessing: Bool = false
}

internal final class LiveVoiceException: GenericException<String> {
  override var reason: String {
    param
  }
}

/// One AVAudioEngine for the mic and the speaker.
/// Voice processing uses this engine's output as the echo reference, so the
/// assistant's voice is cancelled before it is uploaded. Playback has to be
/// scheduled on the player node — a separate AVPlayer is not in the graph.
final class LiveVoice: SharedObject {
  private let lock = NSLock()
  private var engine: AVAudioEngine?
  private var player: AVAudioPlayerNode?
  private var playbackFormat: AVAudioFormat?
  private var tapInstalled = false
  private var started = false
  private var pending = 0
  private var generation = 0
  private var status = LiveVoiceStatus()

  func start() throws -> LiveVoiceStatus {
    if started { return status }

    let session = AVAudioSession.sharedInstance()
    guard session.recordPermission == .granted else {
      throw LiveVoiceException("Microphone access is required for a live conversation.")
    }

    var options: AVAudioSession.CategoryOptions = [.defaultToSpeaker]
    #if compiler(>=6.2)
    options.insert(.allowBluetoothHFP)
    #else
    options.insert(.allowBluetooth)
    #endif
    try session.setCategory(.playAndRecord, mode: .voiceChat, options: options)
    try? session.setPreferredSampleRate(48_000)
    try? session.setPreferredIOBufferDuration(0.02)
    try session.setActive(true)

    let engine = AVAudioEngine()
    let player = AVAudioPlayerNode()
    guard let playbackFormat = AVAudioFormat(
      commonFormat: .pcmFormatFloat32,
      sampleRate: playbackRate,
      channels: 1,
      interleaved: false
    ) else {
      throw LiveVoiceException("The microphone did not start.")
    }

    engine.attach(player)
    engine.connect(player, to: engine.mainMixerNode, format: playbackFormat)

    let input = engine.inputNode
    do {
      try input.setVoiceProcessingEnabled(true)
    } catch {
      throw LiveVoiceException("The microphone did not start.")
    }
    input.isVoiceProcessingBypassed = false
    engine.prepare()

    var format = input.outputFormat(forBus: 0)
    if format.sampleRate == 0 || format.channelCount == 0 {
      try session.setActive(true)
      engine.prepare()
      format = input.outputFormat(forBus: 0)
    }
    guard format.sampleRate > 0, format.channelCount > 0 else {
      throw LiveVoiceException("The microphone did not start.")
    }

    let bufferSize = AVAudioFrameCount(max(256.0, format.sampleRate * 0.02))
    input.installTap(onBus: 0, bufferSize: bufferSize, format: format) { [weak self] buffer, _ in
      self?.emitMic(buffer)
    }
    tapInstalled = true

    do {
      try engine.start()
    } catch {
      input.removeTap(onBus: 0)
      tapInstalled = false
      throw LiveVoiceException("The microphone did not start.")
    }
    player.play()

    self.engine = engine
    self.player = player
    self.playbackFormat = playbackFormat
    started = true
    status.sampleRate = format.sampleRate
    status.voiceProcessing = input.isVoiceProcessingEnabled
    return status
  }

  func stop() {
    lock.lock()
    generation += 1
    pending = 0
    lock.unlock()

    if tapInstalled, let engine {
      engine.inputNode.removeTap(onBus: 0)
      tapInstalled = false
    }
    player?.stop()
    engine?.stop()
    engine = nil
    player = nil
    playbackFormat = nil
    started = false
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }

  func enqueue(base64: String) {
    guard started, let player, let playbackFormat else { return }
    guard let data = Data(base64Encoded: base64, options: .ignoreUnknownCharacters) else { return }
    let frames = data.count / 2
    guard frames > 0 else { return }
    guard let buffer = AVAudioPCMBuffer(
      pcmFormat: playbackFormat,
      frameCapacity: AVAudioFrameCount(frames)
    ) else { return }
    buffer.frameLength = AVAudioFrameCount(frames)
    guard let destination = buffer.floatChannelData?[0] else { return }

    data.withUnsafeBytes { raw in
      guard let bytes = raw.baseAddress?.assumingMemoryBound(to: UInt8.self) else { return }
      for index in 0..<frames {
        let sample = Int16(bitPattern: UInt16(bytes[index * 2]) | (UInt16(bytes[index * 2 + 1]) << 8))
        destination[index] = Float(sample) / 32768.0
      }
    }

    lock.lock()
    let token = generation
    pending += 1
    lock.unlock()

    player.scheduleBuffer(buffer, completionCallbackType: .dataPlayedBack) { [weak self] _ in
      guard let self else { return }
      self.lock.lock()
      let matches = self.generation == token
      if matches { self.pending -= 1 }
      let done = matches && self.pending == 0
      self.lock.unlock()
      guard done else { return }
      self.emit(event: "playbackDrained")
    }
  }

  func stopPlayback() {
    guard started, let player else { return }
    lock.lock()
    generation += 1
    pending = 0
    lock.unlock()
    player.stop()
    if engine?.isRunning == true {
      player.play()
    }
  }

  private func emitMic(_ buffer: AVAudioPCMBuffer) {
    let frames = Int(buffer.frameLength)
    guard frames > 0 else { return }
    let channels = Int(buffer.format.channelCount)
    guard channels > 0 else { return }

    var pcm = [Int16](repeating: 0, count: frames)
    if let floatData = buffer.floatChannelData {
      let interleaved = buffer.format.isInterleaved
      for index in 0..<frames {
        var sum: Float = 0
        if interleaved {
          let samples = floatData[0]
          for channel in 0..<channels {
            sum += samples[index * channels + channel]
          }
        } else {
          for channel in 0..<channels {
            sum += floatData[channel][index]
          }
        }
        let sample = max(-1, min(1, sum / Float(channels)))
        pcm[index] = Int16(sample < 0 ? sample * 32768 : sample * 32767)
      }
    } else if let intData = buffer.int16ChannelData {
      let interleaved = buffer.format.isInterleaved
      for index in 0..<frames {
        var sum = 0
        if interleaved {
          let samples = intData[0]
          for channel in 0..<channels {
            sum += Int(samples[index * channels + channel])
          }
        } else {
          for channel in 0..<channels {
            sum += Int(intData[channel][index])
          }
        }
        pcm[index] = Int16(clamping: sum / channels)
      }
    } else {
      return
    }

    let sampleRate = buffer.format.sampleRate
    let data: NativeArrayBuffer? = pcm.withUnsafeBytes { raw in
      guard let base = raw.baseAddress else { return nil }
      return NativeArrayBuffer.copy(of: base, count: raw.count)
    }
    guard let data, data.byteLength > 0 else { return }
    emit(event: "buffer", payload: [
      "data": data,
      "sampleRate": sampleRate,
      "channels": 1,
    ])
  }

  deinit {
    if tapInstalled {
      engine?.inputNode.removeTap(onBus: 0)
    }
    player?.stop()
    engine?.stop()
  }
}

public class LiveVoiceModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LiveVoice")

    Class(LiveVoice.self) {
      Constructor {
        LiveVoice()
      }

      AsyncFunction("start") { (voice: LiveVoice) -> LiveVoiceStatus in
        try voice.start()
      }
      .runOnQueue(.main)

      AsyncFunction("stop") { (voice: LiveVoice) in
        voice.stop()
      }
      .runOnQueue(.main)

      AsyncFunction("enqueuePcm16Base64") { (voice: LiveVoice, audio: String) in
        voice.enqueue(base64: audio)
      }
      .runOnQueue(.main)

      AsyncFunction("stopPlayback") { (voice: LiveVoice) in
        voice.stopPlayback()
      }
      .runOnQueue(.main)
    }
  }
}
