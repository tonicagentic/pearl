tell application "QuickTime Player"
  activate
  set doc to new screen recording
  delay 1
  -- On recent macOS, starting may require clicking the record button in the UI
  return "created"
end tell
