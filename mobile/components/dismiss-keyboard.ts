import { Keyboard } from "react-native";

/** JS-only keyboard dismiss — keep Keyboard out of Reanimated worklet modules. */
export function dismissKeyboard() {
  Keyboard.dismiss();
}
