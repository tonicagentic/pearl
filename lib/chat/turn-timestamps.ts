/**
 * Derives per-turn user/assistant wall times from the eve event log.
 * Mirrors `@assistant-ui/eve`'s `deriveCreatedAt` so mobile can stamp
 * ThreadMessageLike.createdAt without depending on that package.
 */

export type TurnTimestamps = {
  readonly user?: Date;
  readonly assistant?: Date;
};

export type TurnTimestampCache = {
  lastEvents: readonly unknown[];
  timestamps: ReadonlyMap<string, TurnTimestamps>;
};

type EventLike = {
  readonly type: string;
  readonly data?: {
    readonly turnId?: string;
    readonly parts?: readonly unknown[];
  };
  readonly scope?: { readonly turnId?: string };
  readonly meta?: { readonly at?: unknown };
};

const ROLE_BY_EVENT_TYPE: Readonly<
  Record<string, keyof TurnTimestamps>
> = {
  "delivery.consumed": "user",
  "model.requested": "assistant",
  "model.started": "assistant",
  "content.delta": "assistant",
  "content.completed": "assistant",
  "call.input": "assistant",
  "call.requested": "assistant",
  "call.started": "assistant",
  "call.settled": "assistant",
  "call.progress": "assistant",
  "interaction.opened": "assistant",
};

export const createTurnTimestampCache = (): TurnTimestampCache => ({
  lastEvents: [],
  timestamps: new Map(),
});

/**
 * Eve appends to its log, so a snapshot that keeps the previous scan's last
 * element by identity shares the whole prefix and the scan resumes there.
 */
export const collectTurnTimestamps = (
  events: readonly unknown[],
  cache: TurnTimestampCache,
): ReadonlyMap<string, TurnTimestamps> => {
  if (events === cache.lastEvents) return cache.timestamps;

  const scanned = cache.lastEvents;
  const resumesScan =
    scanned.length === 0 ||
    events[scanned.length - 1] === scanned[scanned.length - 1];

  let timestamps = cache.timestamps;
  let draft: Map<string, TurnTimestamps> | undefined;
  if (!resumesScan) {
    draft = new Map();
    timestamps = draft;
  }

  for (let i = resumesScan ? scanned.length : 0; i < events.length; i++) {
    const event = events[i] as EventLike;
    if (!Object.prototype.hasOwnProperty.call(ROLE_BY_EVENT_TYPE, event.type)) {
      continue;
    }
    const role = ROLE_BY_EVENT_TYPE[event.type];
    if (role === undefined) continue;

    const turnId =
      event.type === "delivery.consumed"
        ? event.data?.turnId
        : event.scope?.turnId;
    if (
      event.type === "delivery.consumed" &&
      (event.data?.parts?.length ?? 0) === 0
    ) {
      continue;
    }
    if (typeof turnId !== "string") continue;

    const known = timestamps.get(turnId);
    if (known?.[role] !== undefined) continue;

    const at = event.meta?.at;
    if (typeof at !== "string") continue;
    const date = new Date(at);
    if (Number.isNaN(date.getTime())) continue;

    draft ??= new Map(timestamps);
    draft.set(turnId, { ...known, [role]: date });
    timestamps = draft;
  }

  cache.lastEvents = events;
  cache.timestamps = timestamps;
  return timestamps;
};
