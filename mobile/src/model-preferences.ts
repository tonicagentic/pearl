import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const MODEL_KEY = "pearl.default_model.v1";

export async function loadSavedModelSelection(): Promise<string | null> {
  if (Platform.OS === "web") {
    return typeof window === "undefined" ? null : window.localStorage.getItem(MODEL_KEY);
  }
  return SecureStore.getItemAsync(MODEL_KEY);
}

// Serialized writes ensure a fast A -> B selection cannot persist A last.
let lastWrite = Promise.resolve();
export function saveModelSelection(key: string): Promise<void> {
  const write = lastWrite.catch(() => {}).then(async () => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") window.localStorage.setItem(MODEL_KEY, key);
      return;
    }
    await SecureStore.setItemAsync(MODEL_KEY, key);
  });
  lastWrite = write;
  return write;
}
