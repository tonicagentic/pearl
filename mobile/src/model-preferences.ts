import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const MODEL_KEY = "pearl.default_model.v1";
const IMAGE_MODEL_KEY = "pearl.image_model.v1";
const VECTOR_MODEL_KEY = "pearl.vector_model.v1";

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

export async function loadSavedImageModelSelection(): Promise<string | null> {
  if (Platform.OS === "web") {
    return typeof window === "undefined"
      ? null
      : window.localStorage.getItem(IMAGE_MODEL_KEY);
  }
  return SecureStore.getItemAsync(IMAGE_MODEL_KEY);
}

let lastImageWrite = Promise.resolve();
export function saveImageModelSelection(key: string): Promise<void> {
  const write = lastImageWrite.catch(() => {}).then(async () => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(IMAGE_MODEL_KEY, key);
      }
      return;
    }
    await SecureStore.setItemAsync(IMAGE_MODEL_KEY, key);
  });
  lastImageWrite = write;
  return write;
}

export async function loadSavedVectorModelSelection(): Promise<string | null> {
  if (Platform.OS === "web") {
    return typeof window === "undefined"
      ? null
      : window.localStorage.getItem(VECTOR_MODEL_KEY);
  }
  return SecureStore.getItemAsync(VECTOR_MODEL_KEY);
}

let lastVectorWrite = Promise.resolve();
export function saveVectorModelSelection(key: string): Promise<void> {
  const write = lastVectorWrite.catch(() => {}).then(async () => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(VECTOR_MODEL_KEY, key);
      }
      return;
    }
    await SecureStore.setItemAsync(VECTOR_MODEL_KEY, key);
  });
  lastVectorWrite = write;
  return write;
}
