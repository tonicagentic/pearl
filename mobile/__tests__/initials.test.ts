import { initials } from "../src/initials";

describe("initials", () => {
  it("uses first and last word letters", () => {
    expect(initials("Alex Chen", "alex@example.com")).toBe("AC");
  });

  it("uses the first two letters of a single word", () => {
    expect(initials("alex", "other@example.com")).toBe("AL");
  });

  it("falls back to the email local-part", () => {
    expect(initials(null, "alex@example.com")).toBe("AL");
    expect(initials("  ", "jane.doe@example.com")).toBe("JA");
  });

  it("returns null when nothing usable is present", () => {
    expect(initials(null, null)).toBeNull();
    expect(initials("", "@")).toBeNull();
  });
});
