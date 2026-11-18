export const MUSCLES = [
  "chest",
  "shoulders",
  "triceps",
  "back",
  "biceps",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "core",
] as const;

export type Muscle = (typeof MUSCLES)[number];

export const DEFAULT_ROTATION_STEPS: Muscle[][] = [
  ["chest", "shoulders", "triceps"],
  ["back", "biceps"],
  ["quads", "glutes", "calves"],
  ["hamstrings", "glutes", "core"],
];

export function isMuscle(value: unknown): value is Muscle {
  return (
    typeof value === "string" &&
    (MUSCLES as readonly string[]).includes(value)
  );
}

export function parseMuscles(raw: string | null | undefined): Muscle[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const muscles = parsed.filter(isMuscle);
    return [...new Set(muscles)];
  } catch {
    return [];
  }
}

export function serializeMuscles(muscles: string[]): string {
  const cleaned = [...new Set(muscles.filter(isMuscle))];
  return JSON.stringify(cleaned);
}

export type RotationStepInput = {
  muscles: Muscle[];
};

export type RotationAssignment = {
  /** Whether this weekday is a training day for the user. */
  isTrainingDay: boolean;
  /** Muscles due today (or just completed if completed today). */
  muscles: Muscle[];
  /** Index of the step shown (the current/due step). */
  stepIndex: number;
  /** True when the user already marked today's queue step complete. */
  completedToday: boolean;
  /** Muscles from the fixed catalog that never appear in any step. */
  missingMuscles: Muscle[];
};

export function missingMusclesFromSteps(steps: Muscle[][]): Muscle[] {
  const covered = new Set(steps.flat());
  return MUSCLES.filter((m) => !covered.has(m));
}

/**
 * Resolve what to show for a given date from queue state.
 * Rest days leave the index alone and return empty muscles.
 * Completing today shows the step that was just completed (previous index).
 */
export function resolveRotationAssignment(input: {
  isTrainingDay: boolean;
  steps: Muscle[][];
  nextIndex: number;
  completedOn: string | null;
  date: string;
}): RotationAssignment {
  const steps =
    input.steps.length > 0 ? input.steps : DEFAULT_ROTATION_STEPS;
  const len = steps.length;
  const nextIndex =
    Number.isInteger(input.nextIndex) && input.nextIndex >= 0
      ? input.nextIndex % len
      : 0;
  const completedToday = input.completedOn === input.date;
  const missingMuscles = missingMusclesFromSteps(steps);

  if (!input.isTrainingDay) {
    return {
      isTrainingDay: false,
      muscles: [],
      stepIndex: nextIndex,
      completedToday: false,
      missingMuscles,
    };
  }

  if (completedToday) {
    const completedIndex = (nextIndex - 1 + len) % len;
    return {
      isTrainingDay: true,
      muscles: steps[completedIndex] ?? [],
      stepIndex: completedIndex,
      completedToday: true,
      missingMuscles,
    };
  }

  return {
    isTrainingDay: true,
    muscles: steps[nextIndex] ?? [],
    stepIndex: nextIndex,
    completedToday: false,
    missingMuscles,
  };
}

/**
 * Advance the queue after marking trained.
 * Idempotent for the same day: already completed today → no change.
 */
export function advanceRotation(input: {
  nextIndex: number;
  completedOn: string | null;
  date: string;
  stepCount: number;
}): { nextIndex: number; completedOn: string; advanced: boolean } {
  const len = Math.max(1, input.stepCount);
  const current =
    Number.isInteger(input.nextIndex) && input.nextIndex >= 0
      ? input.nextIndex % len
      : 0;

  if (input.completedOn === input.date) {
    return {
      nextIndex: current,
      completedOn: input.date,
      advanced: false,
    };
  }

  return {
    nextIndex: (current + 1) % len,
    completedOn: input.date,
    advanced: true,
  };
}

/**
 * Undo today's completion: roll nextIndex back one and clear completedOn.
 * Only valid when completedOn === date.
 */
export function undoRotationCompletion(input: {
  nextIndex: number;
  completedOn: string | null;
  date: string;
  stepCount: number;
}): { nextIndex: number; completedOn: string | null; undone: boolean } {
  const len = Math.max(1, input.stepCount);
  const current =
    Number.isInteger(input.nextIndex) && input.nextIndex >= 0
      ? input.nextIndex % len
      : 0;

  if (input.completedOn !== input.date) {
    return {
      nextIndex: current,
      completedOn: input.completedOn,
      undone: false,
    };
  }

  return {
    nextIndex: (current - 1 + len) % len,
    completedOn: null,
    undone: true,
  };
}
