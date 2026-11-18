export type BarcodeLookupResult = {
  barcode: string;
  name: string;
  servingLabel: string;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  source: "openfoodfacts" | "not_found";
  found: boolean;
};

function cleanBarcode(raw: string): string {
  return raw.replace(/\D/g, "");
}

function numOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100) / 100;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.round(n * 100) / 100;
  }
  return null;
}

function pickName(product: Record<string, unknown>): string {
  const productName =
    typeof product.product_name === "string" ? product.product_name.trim() : "";
  const brands = typeof product.brands === "string" ? product.brands.trim() : "";
  if (productName && brands) return `${brands} ${productName}`;
  if (productName) return productName;
  if (brands) return brands;
  return "Scanned product";
}

/**
 * Look up a packaged food by UPC/EAN via Open Food Facts.
 * Macros are returned as null when OFF has no usable nutrition data.
 */
export async function lookupOpenFoodFacts(
  rawCode: string,
): Promise<BarcodeLookupResult> {
  const barcode = cleanBarcode(rawCode);
  if (barcode.length < 8 || barcode.length > 14) {
    throw new Error("Invalid barcode");
  }

  const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "PearlBody/1.0 (https://pearl.tonicagentic.com)",
    },
  });

  if (!res.ok) {
    throw new Error(`Open Food Facts request failed (${res.status})`);
  }

  const json = (await res.json()) as {
    status?: number;
    product?: Record<string, unknown>;
  };

  if (json.status !== 1 || !json.product) {
    return {
      barcode,
      name: "",
      servingLabel: "1 serving",
      calories: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
      source: "not_found",
      found: false,
    };
  }

  const product = json.product;
  const nutriments =
    product.nutriments && typeof product.nutriments === "object"
      ? (product.nutriments as Record<string, unknown>)
      : {};

  const servingSize =
    typeof product.serving_size === "string" && product.serving_size.trim()
      ? product.serving_size.trim()
      : null;

  // Prefer per-serving nutriments when a serving size exists; else per 100g.
  const useServing = Boolean(servingSize);
  const calories = useServing
    ? numOrNull(nutriments["energy-kcal_serving"]) ??
      numOrNull(nutriments.energy_kcal_serving)
    : numOrNull(nutriments["energy-kcal_100g"]) ??
      numOrNull(nutriments.energy_kcal_100g);
  const proteinG = useServing
    ? numOrNull(nutriments.proteins_serving)
    : numOrNull(nutriments.proteins_100g);
  const carbsG = useServing
    ? numOrNull(nutriments.carbohydrates_serving)
    : numOrNull(nutriments.carbohydrates_100g);
  const fatG = useServing
    ? numOrNull(nutriments.fat_serving)
    : numOrNull(nutriments.fat_100g);

  return {
    barcode,
    name: pickName(product),
    servingLabel: servingSize || "100 g",
    calories,
    proteinG,
    carbsG,
    fatG,
    source: "openfoodfacts",
    found: true,
  };
}
