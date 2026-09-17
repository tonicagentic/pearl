import { loadYaml } from "eve/evals/loaders";

// Rubrics live in evals/data/rubrics.yaml as data, not hardcoded in test
// logic. dot-path lookup keeps eval files readable: rubric("sycophancy.rule_wins").

const RUBRICS = (await loadYaml("evals/data/rubrics.yaml")) as Record<
  string,
  Record<string, unknown>
>;

const SCENARIOS = (await loadYaml(
  "evals/data/behavior-scenarios.yaml",
)) as unknown;

export function rubric(path: string): string {
  const [section, key] = path.split(".");
  const value = RUBRICS[section]?.[key];

  if (typeof value !== "string") {
    throw new Error(`Missing rubric for ${path} in evals/data/rubrics.yaml`);
  }

  return value;
}

export function scenarios<T>(): T {
  return SCENARIOS as T;
}
