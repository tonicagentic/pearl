import { selectAgentsForUi } from "../src/chat/agents-for-ui";

describe("selectAgentsForUi", () => {
  const storeA = { id: "a" };
  const storeB = { id: "b" };
  const agentsA = { child: { name: "coder-a" } };
  const agentsB = { child: { name: "coder-b" } };

  it("uses live agents while the turn is open and updates the freeze", () => {
    const next = selectAgentsForUi({
      store: storeA,
      agents: agentsA,
      turnOpen: true,
      frozenStore: null,
      frozenAgents: {},
    });
    expect(next.agents).toBe(agentsA);
    expect(next.frozenStore).toBe(storeA);
    expect(next.frozenAgents).toBe(agentsA);
  });

  it("keeps the freeze for the same store when the turn settles", () => {
    const next = selectAgentsForUi({
      store: storeA,
      agents: {},
      turnOpen: false,
      frozenStore: storeA,
      frozenAgents: agentsA,
    });
    expect(next.agents).toBe(agentsA);
  });

  it("drops the previous store's agents when the active store changes", () => {
    const next = selectAgentsForUi({
      store: storeB,
      agents: agentsB,
      turnOpen: false,
      frozenStore: storeA,
      frozenAgents: agentsA,
    });
    expect(next.agents).toBe(agentsB);
    expect(next.frozenStore).toBe(storeB);
    expect(next.frozenAgents).toBe(agentsB);
  });
});
