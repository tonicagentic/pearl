import { AsyncLocalStorage } from "node:async_hooks";

type BodyContext = { userId: string };

const als = new AsyncLocalStorage<BodyContext>();

/** Run body service code scoped to the authenticated Pearl user. */
export function runAsUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  if (!userId) throw new Error("runAsUser requires a userId");
  return als.run({ userId }, fn);
}

export function getUserId(): string {
  const store = als.getStore();
  if (!store) throw new Error("getUserId() called outside runAsUser");
  return store.userId;
}
