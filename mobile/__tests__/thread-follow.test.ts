import { followEndOffset } from "../src/chat/thread-follow";

describe("followEndOffset", () => {
  it("keeps a short keyboard-open tail under the header", () => {
    // content = top inset + bubble + composer pad; still shorter than the
    // viewport below the glass bar, so scrolling to the end would pull the
    // bubble into the header.
    expect(
      followEndOffset({
        contentHeight: 800,
        viewportHeight: 700,
        topInset: 110,
      }),
    ).toBe(0);
  });

  it("pins a long thread to the end", () => {
    expect(
      followEndOffset({
        contentHeight: 2000,
        viewportHeight: 700,
        topInset: 110,
      }),
    ).toBe(1300);
  });

  it("returns 0 when the viewport is not measured yet", () => {
    expect(
      followEndOffset({
        contentHeight: 2000,
        viewportHeight: 0,
        topInset: 110,
      }),
    ).toBe(0);
  });
});
