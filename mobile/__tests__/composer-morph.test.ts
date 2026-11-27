import {
  COMPOSER_CHIP,
  COMPOSER_EDGE,
  COMPOSER_EXPANDED_INPUT_MAX,
  COMPOSER_EXPANDED_INPUT_MIN,
  COMPOSER_MINIMIZED_EDGE,
  COMPOSER_MORPH_RANGE,
  COMPOSER_ROW_GAP,
  composerChromeProgress,
  composerHoldScale,
  composerInputWidth,
  composerKeyboardProgress,
  composerPlaceholderOpacity,
  composerPressBump,
  composerWidthProgress,
  estimateComposerInputHeight,
} from "../components/assistant-ui/elements/composer-morph";

describe("composerKeyboardProgress", () => {
  it("clamps at 0 and 1 and tracks mid-travel", () => {
    expect(composerKeyboardProgress(0, COMPOSER_MORPH_RANGE)).toBe(0);
    expect(composerKeyboardProgress(COMPOSER_MORPH_RANGE, COMPOSER_MORPH_RANGE)).toBe(
      1,
    );
    expect(
      composerKeyboardProgress(COMPOSER_MORPH_RANGE / 2, COMPOSER_MORPH_RANGE),
    ).toBeCloseTo(0.5);
    expect(composerKeyboardProgress(-10, COMPOSER_MORPH_RANGE)).toBe(0);
    expect(
      composerKeyboardProgress(COMPOSER_MORPH_RANGE * 2, COMPOSER_MORPH_RANGE),
    ).toBe(1);
  });

  it("uses the larger of span and morph range", () => {
    expect(composerKeyboardProgress(60, 240)).toBeCloseTo(0.25);
  });
});

describe("composerWidthProgress / composerChromeProgress", () => {
  it("prefers sticky and text expansion over keyboard alone", () => {
    expect(composerWidthProgress(0.2, 1, 0)).toBe(1);
    expect(composerWidthProgress(0.2, 0, 1)).toBe(1);
    expect(composerWidthProgress(0.4, 0.1, 0.2)).toBe(0.4);

    expect(composerChromeProgress(0, 1, COMPOSER_MORPH_RANGE)).toBe(1);
    expect(composerChromeProgress(0, 0, COMPOSER_MORPH_RANGE, 1)).toBe(1);
    expect(
      composerChromeProgress(COMPOSER_MORPH_RANGE / 2, 0, COMPOSER_MORPH_RANGE),
    ).toBeCloseTo(0.5);
  });
});

describe("composerPressBump / composerHoldScale", () => {
  it("returns identity when disabled", () => {
    expect(composerPressBump(1, 1, false)).toBe(1);
    expect(composerHoldScale(0, 1, false)).toBe(1);
  });

  it("applies bump only while expanded", () => {
    expect(composerPressBump(0, 1, true)).toBe(1);
    expect(composerPressBump(1, 1, true)).toBeCloseTo(1.02);
  });

  it("applies hold shrink only while collapsed", () => {
    expect(composerHoldScale(1, 1, true)).toBe(1);
    expect(composerHoldScale(0, 1, true)).toBeCloseTo(0.975);
  });
});

describe("composerInputWidth", () => {
  const windowWidth = 390;

  it("matches collapsed and expanded rest poses", () => {
    const shellPad = 16;
    const collapsed = windowWidth - COMPOSER_MINIMIZED_EDGE * 2 - shellPad;
    const mini = collapsed - COMPOSER_CHIP * 2 - COMPOSER_ROW_GAP * 2;
    const expanded = windowWidth - COMPOSER_EDGE * 2 - shellPad;

    const atRest = composerInputWidth(windowWidth, 0);
    expect(atRest.left).toBe(COMPOSER_CHIP + COMPOSER_ROW_GAP);
    expect(atRest.width).toBe(mini);

    const open = composerInputWidth(windowWidth, 1);
    expect(open.left).toBe(0);
    expect(open.width).toBe(expanded);
  });
});

describe("composerPlaceholderOpacity", () => {
  it("is fully gone once the field crosses the model button", () => {
    expect(composerPlaceholderOpacity(0)).toBe(1);
    expect(composerPlaceholderOpacity(0.1)).toBe(0);
    expect(composerPlaceholderOpacity(0.5)).toBe(0);
    expect(composerPlaceholderOpacity(0.92)).toBe(0);
    expect(composerPlaceholderOpacity(1)).toBe(1);
  });
});

describe("estimateComposerInputHeight", () => {
  const windowWidth = 393;

  it("keeps the recording draft at two lines, then one when shortened", () => {
    const twoLine = estimateComposerInputHeight({
      text: "how do i get over this past trauma with the vulnerability and relationship",
      windowWidth,
    });
    expect(twoLine.lines).toBe(2);
    expect(twoLine.height).toBeGreaterThan(COMPOSER_EXPANDED_INPUT_MIN);
    expect(twoLine.height).toBeLessThan(COMPOSER_EXPANDED_INPUT_MAX);

    const oneLine = estimateComposerInputHeight({
      text: "how do i get over this past",
      windowWidth,
    });
    expect(oneLine.lines).toBe(1);
    expect(oneLine.height).toBe(COMPOSER_EXPANDED_INPUT_MIN);
    expect(oneLine.height).toBeLessThan(twoLine.height);
  });

  it("caps a long multiline draft at the expanded max", () => {
    const long = estimateComposerInputHeight({
      text: Array.from({ length: 20 }, (_, i) => `line ${i} of a long draft`).join(
        "\n",
      ),
      windowWidth,
    });
    expect(long.height).toBe(COMPOSER_EXPANDED_INPUT_MAX);
    expect(long.lines).toBeGreaterThan(2);
  });
});
