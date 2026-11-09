const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("expo/config-plugins");

const RECORD_ONLY =
  "try session.setCategory(.record, mode: .measurement)";

// AudioStream.start() otherwise forces a record-only session. Playback stays
// silent, and the live screen keeps the microphone suppressed until a clip
// that can never finish reports that it ended.
const PLAY_AND_RECORD = `var liveOptions: AVAudioSession.CategoryOptions = [.defaultToSpeaker]
    #if compiler(>=6.2)
    liveOptions.insert(.allowBluetoothHFP)
    #else
    liveOptions.insert(.allowBluetooth)
    #endif
    try session.setCategory(.playAndRecord, mode: .voiceChat, options: liveOptions)`;

function withLiveAudioSession(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const packageJson = require.resolve("expo-audio/package.json", {
        paths: [config.modRequest.projectRoot],
      });
      const file = path.join(path.dirname(packageJson), "ios", "AudioStream.swift");
      const source = fs.readFileSync(file, "utf8");
      if (source.includes(PLAY_AND_RECORD)) return config;
      if (!source.includes(RECORD_ONLY)) {
        throw new Error(
          "expo-audio AudioStream.start() no longer sets a record-only session. Update plugins/with-live-audio-session.js.",
        );
      }
      fs.writeFileSync(file, source.replace(RECORD_ONLY, PLAY_AND_RECORD));
      return config;
    },
  ]);
}

module.exports = withLiveAudioSession;
