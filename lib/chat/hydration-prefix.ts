import type { ClientSessionState, SessionStreamEvent } from "eve/client";

type PositionedEvent = {
  readonly event: SessionStreamEvent;
  readonly line: number;
  readonly index: number;
  readonly order: number;
};

function streamPosition(
  event: SessionStreamEvent,
): { readonly line: number; readonly index: number } | null {
  const position = (
    event as {
      readonly meta?: {
        readonly position?: { readonly line?: unknown; readonly index?: unknown };
      };
    }
  ).meta?.position;
  if (
    !position ||
    typeof position.line !== "number" ||
    typeof position.index !== "number" ||
    !Number.isSafeInteger(position.line) ||
    !Number.isSafeInteger(position.index)
  ) {
    return null;
  }
  return { line: position.line, index: position.index };
}

function closesLine(event: SessionStreamEvent): boolean {
  return (
    (event as { readonly meta?: { readonly endOfLine?: unknown } }).meta
      ?.endOfLine !== false
  );
}

function cursorAfter(event: SessionStreamEvent, line: number): number {
  const next = (event as { readonly meta?: { readonly next?: unknown } }).meta
    ?.next;
  if (typeof next === "number" && Number.isSafeInteger(next) && next >= line + 1) {
    return next;
  }
  return line + 1;
}

/**
 * eve hydrates `initialEvents` as a forward-only stream prefix. A presence
 * mirror that lands at event index 0 with a later line makes eve drop every
 * earlier line, and a saved line past a hole (the missing interaction.opened)
 * advances the resume cursor over that hole. Return the contiguous prefix and
 * the next line resume should read.
 */
export function repairSessionHydration(
  events: readonly SessionStreamEvent[],
  session?: ClientSessionState | null,
): {
  readonly events: readonly SessionStreamEvent[];
  readonly streamIndex: number | undefined;
} {
  const positioned: PositionedEvent[] = [];
  for (let order = 0; order < events.length; order += 1) {
    const event = events[order]!;
    const position = streamPosition(event);
    if (!position) continue;
    positioned.push({ event, order, ...position });
  }

  positioned.sort(
    (left, right) =>
      left.line - right.line || left.index - right.index || left.order - right.order,
  );

  const deduped: PositionedEvent[] = [];
  for (const item of positioned) {
    const previous = deduped[deduped.length - 1];
    if (previous && previous.line === item.line && previous.index === item.index) {
      if (closesLine(item.event) || !closesLine(previous.event)) {
        deduped[deduped.length - 1] = item;
      }
      continue;
    }
    deduped.push(item);
  }

  const prefix: SessionStreamEvent[] = [];
  let covered: number | null = null;
  for (const item of deduped) {
    if (covered !== null && item.line > covered) break;
    prefix.push(item.event);
    if (closesLine(item.event)) covered = cursorAfter(item.event, item.line);
  }

  const hydratedEvents = admitMissingDeliveries(prefix);

  const saved = session?.streamIndex;
  const streamIndex =
    covered == null
      ? saved
      : saved == null
        ? covered
        : Math.min(saved, covered);

  return { events: hydratedEvents, streamIndex };
}

/**
 * `delivery.consumed` only updates a delivery that was already admitted.
 * Presence mirrors saved the consumed row and not the admission, so the
 * user text never became a message. Insert the missing admission on the
 * same line, just before the consumed event.
 */
function admitMissingDeliveries(
  events: readonly SessionStreamEvent[],
): SessionStreamEvent[] {
  const admitted = new Set<string>();
  for (const event of events) {
    if (event.type !== "delivery.admitted") continue;
    const deliveryId = deliveryIdOf(event);
    if (deliveryId) admitted.add(deliveryId);
  }

  const next = [...events];
  for (let index = 0; index < next.length; index += 1) {
    const event = next[index]!;
    if (event.type !== "delivery.consumed") continue;
    const deliveryId = deliveryIdOf(event);
    if (!deliveryId || admitted.has(deliveryId)) continue;
    const position = streamPosition(event);
    if (!position) continue;

    for (let later = index; later < next.length; later += 1) {
      const other = next[later]!;
      const otherPosition = streamPosition(other);
      if (
        !otherPosition ||
        otherPosition.line !== position.line ||
        otherPosition.index < position.index
      ) {
        continue;
      }
      next[later] = withPosition(other, {
        line: otherPosition.line,
        index: otherPosition.index + 1,
      });
    }

    next.splice(
      index,
      0,
      withPosition(
        {
          type: "delivery.admitted",
          data: { deliveryId },
          meta: { endOfLine: false },
        } as SessionStreamEvent,
        position,
      ),
    );
    admitted.add(deliveryId);
    index += 1;
  }

  return next;
}

function deliveryIdOf(event: SessionStreamEvent): string | null {
  const deliveryId = (event as { readonly data?: { readonly deliveryId?: unknown } })
    .data?.deliveryId;
  return typeof deliveryId === "string" ? deliveryId : null;
}

function withPosition(
  event: SessionStreamEvent,
  position: { readonly line: number; readonly index: number },
): SessionStreamEvent {
  const meta =
    ((event as unknown as { readonly meta?: Record<string, unknown> }).meta) ??
    {};
  return {
    ...event,
    meta: { ...meta, position },
  } as SessionStreamEvent;
}
