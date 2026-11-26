import { focusedNestedStackCanGoBack } from "../src/drawer-nested-back";

describe("focusedNestedStackCanGoBack", () => {
  it("is false for a root stack screen", () => {
    expect(
      focusedNestedStackCanGoBack({
        type: "stack",
        index: 0,
        routes: [{ key: "index", name: "index" }],
      }),
    ).toBe(false);
  });

  it("is true when the focused stack has history", () => {
    expect(
      focusedNestedStackCanGoBack({
        type: "stack",
        index: 1,
        routes: [
          { key: "index", name: "index" },
          { key: "list", name: "list/[bucket]" },
        ],
      }),
    ).toBe(true);
  });

  it("treats untyped navigators with index > 0 as back-capable", () => {
    expect(
      focusedNestedStackCanGoBack({
        index: 1,
        routes: [
          { key: "index", name: "index" },
          { key: "list", name: "list/[bucket]" },
        ],
      }),
    ).toBe(true);
  });

  it("walks into the focused drawer child", () => {
    expect(
      focusedNestedStackCanGoBack({
        type: "drawer",
        index: 0,
        routes: [
          {
            key: "tasks",
            name: "tasks",
            state: {
              type: "stack",
              index: 1,
              routes: [
                { key: "index", name: "index" },
                { key: "id", name: "[id]" },
              ],
            },
          },
        ],
      }),
    ).toBe(true);
  });

  it("is false when the focused drawer child is at its root", () => {
    expect(
      focusedNestedStackCanGoBack({
        type: "drawer",
        index: 0,
        routes: [
          {
            key: "tasks",
            name: "tasks",
            state: {
              type: "stack",
              index: 0,
              routes: [{ key: "index", name: "index" }],
            },
          },
        ],
      }),
    ).toBe(false);
  });

  it("does not treat drawer sibling index as back", () => {
    expect(
      focusedNestedStackCanGoBack({
        type: "drawer",
        index: 1,
        routes: [
          { key: "home", name: "(home)" },
          {
            key: "tasks",
            name: "tasks",
            state: {
              type: "stack",
              index: 0,
              routes: [{ key: "index", name: "index" }],
            },
          },
        ],
      }),
    ).toBe(false);
  });
});
