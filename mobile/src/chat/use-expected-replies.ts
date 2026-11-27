import { useCallback, useMemo, useState } from "react";
import type { SessionStore, SessionStoreSnapshot } from "eve/client";
import { activeTurn, delivery, session, turn } from "eve/events";
import { expectedReplyState, type ExpectedReply } from "../../../lib/chat/empty-turn";

type Expectation = {
  readonly key: object;
  readonly receipt?: ExpectedReply;
};
const NO_EXPECTATIONS: readonly Expectation[] = [];

function observeReply(snapshot: SessionStoreSnapshot, receipt: ExpectedReply | undefined) {
  // Select with mobile's eve instance; SessionView is opaque and instance-local.
  const received = receipt ? delivery(snapshot.view, receipt.deliveryId) : undefined;
  return expectedReplyState({
    ...snapshot,
    received,
    expectedTurn: received?.turnId ? turn(snapshot.view, received.turnId) : undefined,
    hasOpenTurn: activeTurn(snapshot.view) !== undefined,
    sessionEnded: session(snapshot.view).status === "ended",
  }, receipt);
}

/** Local sends may queue behind each other; never share their reply lifecycle. */
export function useExpectedReplies(store: SessionStore, snapshot: SessionStoreSnapshot) {
  const [byStore, setByStore] = useState(() => new Map<SessionStore, readonly Expectation[]>());
  const expected = byStore.get(store) ?? NO_EXPECTATIONS;
  const states = useMemo(
    () => expected.map((entry) => ({ entry, state: observeReply(snapshot, entry.receipt) })),
    [expected, snapshot],
  );

  const begin = useCallback((source: SessionStore, key: object) => {
    const currentSnapshot = source.snapshot;
    setByStore((current) => {
      // A new send dismisses old terminal notices, not other queued replies.
      const pending = (current.get(source) ?? []).filter((entry) =>
        entry.key !== key && observeReply(currentSnapshot, entry.receipt) === "pending"
      );
      return new Map(current).set(source, [...pending, { key }]);
    });
  }, []);

  const accept = useCallback((source: SessionStore, key: object, receipt: ExpectedReply) => {
    setByStore((current) => {
      const entries = current.get(source);
      if (!entries?.some((entry) => entry.key === key)) return current;
      return new Map(current).set(source, entries.map((entry) =>
        entry.key === key ? { key, receipt } : entry
      ));
    });
  }, []);

  const forget = useCallback((source: SessionStore, key: object) => {
    setByStore((current) => {
      const entries = current.get(source);
      if (!entries?.some((entry) => entry.key === key)) return current;
      const remaining = entries.filter((entry) => entry.key !== key);
      const next = new Map(current);
      if (remaining.length) next.set(source, remaining);
      else next.delete(source);
      return next;
    });
  }, []);

  // Completed entries are pruned on the next begin, not by a render effect.
  // Empty entries remain observable so late matching output hides the notice.

  return {
    begin,
    accept,
    forget,
    expectingAssistant: states.some(({ state }) => state === "pending"),
    // Derived separately from transport/send errors. Matching late output,
    // reconnect, or new live work hides this notice without clearing those.
    emptyReplyError: states.some(({ state }) => state === "empty")
      ? "Pearl didn't return a reply for this turn."
      : null,
  };
}
