// Per-file mutation lock: the model can emit several tool calls in one turn
// and eve may execute them concurrently. edit_file is read-modify-write, so
// two parallel edits on the same file interleave (both read the same base,
// both write, last-write-wins) and one edit is silently lost. Serializing
// same-file mutations removes the race while leaving different files free to
// proceed in parallel. Process-scoped, which matches where authored tools run.

const locks = new Map<string, Promise<unknown>>();

export function withFileLock<T>(path: string, task: () => Promise<T>): Promise<T> {
  const previous = locks.get(path) ?? Promise.resolve();
  const next = previous.then(task, task);
  locks.set(path, next);

  // Drop the tail entry once it settles so the map does not grow unbounded;
  // only clear while it is still the tail (a newer waiter may have chained).
  // The catch keeps the cleanup branch from raising an unhandled rejection —
  // the caller's own `next` promise still rejects normally.
  void next
    .catch(() => {})
    .finally(() => {
      if (locks.get(path) === next) {
        locks.delete(path);
      }
    });

  return next;
}
