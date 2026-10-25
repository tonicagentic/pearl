# iOS release gate

Run this on a physical iPhone using a release/TestFlight build, not only Expo Go or a simulator. Do not ship if any item fails. Record device, iOS version, build number, network conditions, and the result of each run.

## Automated checks

From `mobile/`:

```sh
npx expo lint
npx tsc --noEmit
npx expo-doctor
npx expo install --check
```

From the repository root, run `pnpm typecheck` when changing `/api/chats/*` or eve session persistence. A local iOS simulator build is `npx expo run:ios` from `mobile/`; `app.json` intentionally builds React Native from source because the prebuilt RN iOS framework failed to link with Gesture Handler in this checkout. Expect a slower first build.

## Device scenarios

- Cold launch, restore an existing session, sign out, sign in as another account. No previous account's chats or messages should appear; sign-in must be required in development and production.
- New chat, send text, stop mid-stream, then send a follow-up. Each action must produce exactly one user message and a coherent assistant response or a visible failure.
- Switch chats while a response is streaming, then switch back. Neither conversation should contain the other's events or session cursor.
- Force-quit mid-response and reopen. The session should replay its durable events; an uncertain pending message must be shown, not silently resent.
- Disconnect network during send, during streaming, during history loading, and during a save. Keep prior content on screen, display a useful error, reconnect, and retry without duplicating messages.
- Open 100+ conversations and a long transcript. History scrolling, message scrolling, and typing should remain responsive; loading more history should not jump to the top.
- On a signed-in iPhone, tap History, swipe open from the left edge (interactive drag), or flick open horizontally from elsewhere on the chat; the Recents list and the chat transcript must still scroll vertically. Drag the drawer partially then release to both positions, swipe it closed, and tap the peeking chat card to close. Each completed open or close should give exactly one subtle haptic (not one per drag frame); a cancelled drag should give none. Confirm the chat blurs as the drawer opens (or dims when Reduce Transparency is on). Open History while the keyboard is up and while a response is streaming, then pick a chat, create a new chat from the floating bottom control, and navigate to Areas/Issues: no composer or stream should remount unexpectedly. Repeat in VoiceOver, Reduce Motion, and on an iPad.
- On an iPhone, focus the composer, dismiss with Done and by dragging the transcript interactively, then repeat with a multiline draft, predictive text, and the emoji keyboard. The composer should follow the keyboard without a second jump or an extra home-indicator gap; the caret and send/stop control stay visible and focus is preserved when appropriate. Keep a transcript scrolled away from the bottom while toggling the keyboard and verify its reading position does not jump.
- On an iPad, repeat with both docked and floating keyboards; floating keyboards must not lift the whole transcript as if docked. Open and close the model picker while a draft is present.
- On iOS, select photos (including multi-select and remove), send an image-only turn and a text-plus-image turn, then reopen the chat: the model should receive the images and the history should show file chips, never base64. Try an oversized/failed image and force-quit mid-send: keep an honest pending state; never silently resend. Select a small TXT/Markdown file and a text-layer PDF from Files; verify extracted PDF pages can be read through read_attachment. Unsupported/scanned or offline PDFs should show a useful error without sending. Test the native model menu with the keyboard open: selection gets a checkmark, the draft remains, and only the selected model is used for the next turn.
- On iOS 26, scroll a long thread behind the composer with the keyboard closed, open, and interactively dismissing. Only the rounded input surface should blur; the full-width footer and home-indicator area stay transparent, the last message scrolls fully above the composer, and tapping the visible message area still scrolls. Recheck after multiline input grows and shrinks, switching chats, changing theme, and opening the model picker. On older iOS and with Reduce Transparency enabled, the fallback surface must remain legible without painting a full-width footer.
- Create an issue with due/review dates, change them, clear them, resolve/reopen an issue, and navigate back using the iOS swipe gesture.
- Repeat in light/dark mode, large Dynamic Type, VoiceOver, and on both a small iPhone and a larger iPhone.

Run release build smoke tests again after changing Expo SDK/native dependencies. A passing typecheck or Expo Doctor result is not a substitute for a successful native build and this device checklist.
