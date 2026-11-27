/**
 * Followed child sessions for the open thread.
 *
 * While a turn is open we paint live agents. When it settles we freeze the
 * last open snapshot so follow↔caught-up ticks do not rebuild TaskGroup —
 * but only for the same SessionStore. Switching chats must drop the freeze.
 */

export function selectAgentsForUi<TAgents>(input: {
  readonly store: object;
  readonly agents: TAgents;
  readonly turnOpen: boolean;
  readonly frozenStore: object | null;
  readonly frozenAgents: TAgents;
}): {
  readonly agents: TAgents;
  readonly frozenStore: object;
  readonly frozenAgents: TAgents;
} {
  if (input.turnOpen) {
    return {
      agents: input.agents,
      frozenStore: input.store,
      frozenAgents: input.agents,
    };
  }
  if (input.frozenStore === input.store) {
    return {
      agents: input.frozenAgents,
      frozenStore: input.frozenStore,
      frozenAgents: input.frozenAgents,
    };
  }
  return {
    agents: input.agents,
    frozenStore: input.store,
    frozenAgents: input.agents,
  };
}
