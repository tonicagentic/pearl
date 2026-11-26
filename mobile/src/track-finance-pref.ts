import * as SecureStore from "expo-secure-store";

const KEY = "pearl.track_show_finance";

let memoryEnabled: boolean | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

/** Whether Track shows the Finance card (device pref, default off). */
export function getTrackShowFinance(): boolean {
  return memoryEnabled === true;
}

export function subscribeTrackShowFinance(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function loadTrackShowFinance(): Promise<boolean> {
  if (memoryEnabled != null) return memoryEnabled;
  try {
    const value = await SecureStore.getItemAsync(KEY);
    memoryEnabled = value === "1";
  } catch {
    memoryEnabled = false;
  }
  notify();
  return memoryEnabled;
}

export async function setTrackShowFinance(enabled: boolean): Promise<void> {
  memoryEnabled = enabled;
  notify();
  try {
    if (enabled) await SecureStore.setItemAsync(KEY, "1");
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Memory flag still drives this session.
  }
}
