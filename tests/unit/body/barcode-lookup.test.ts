import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lookupOpenFoodFacts } from "@/lib/body/barcode-lookup";

describe("lookupOpenFoodFacts", () => {
  it("rejects short barcodes", async () => {
    await assert.rejects(() => lookupOpenFoodFacts("123"), /Invalid barcode/);
  });

  it("looks up a known Nutella barcode when network is available", async () => {
    // Classic Nutella 400g EAN — may be flaky offline; skip soft-fail if OFF is down.
    try {
      const result = await lookupOpenFoodFacts("3017620422003");
      if (!result.found) return;
      assert.equal(result.barcode, "3017620422003");
      assert.ok(result.name.length > 0);
      assert.equal(result.source, "openfoodfacts");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/failed|fetch|network/i.test(message)) return;
      throw err;
    }
  });
});
