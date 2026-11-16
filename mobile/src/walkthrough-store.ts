import * as SecureStore from "expo-secure-store";

const KEY = "pearl.walkthrough_done";

let memoryDone: boolean | null = null;

export async function loadWalkthroughDone(): Promise<boolean> {
  if (memoryDone != null) return memoryDone;
  try {
    const value = await SecureStore.getItemAsync(KEY);
    memoryDone = value === "1";
    return memoryDone;
  } catch {
    memoryDone = false;
    return false;
  }
}

export async function markWalkthroughDone(): Promise<void> {
  memoryDone = true;
  try {
    await SecureStore.setItemAsync(KEY, "1");
  } catch {
    // Memory flag still skips the tour this session.
  }
}
