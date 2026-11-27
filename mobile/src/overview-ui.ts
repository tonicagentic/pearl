/** Pure Overview tab copy + project navigation contracts (home vs drawer). */

export type ProjectEntryFrom = "overview" | "drawer" | undefined;

export function firstNameFrom(viewerName: string | null): string | null {
  const trimmed = viewerName?.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0] ?? null;
}

export function overviewGreeting(now: Date, firstName: string | null): string {
  const hour = now.getHours();
  const base =
    hour < 12
      ? "Good morning"
      : hour < 17
        ? "Good afternoon"
        : "Good evening";
  return firstName ? `${base}, ${firstName}` : base;
}

export function overviewDateLabel(now: Date): string {
  return now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function pluralCount(count: number, one: string, many: string): string {
  return count === 1 ? one : many.replace("{n}", String(count));
}

export function overviewTasksLead(input: {
  readonly dueToday: number;
  readonly inbox: number;
}): string {
  const { dueToday: due, inbox } = input;
  if (due === 0) {
    if (inbox === 0) return "Nothing is due today.";
    return `Nothing is due today. ${pluralCount(
      inbox,
      "1 task is waiting in your inbox.",
      "{n} tasks are waiting in your inbox.",
    )}`;
  }
  const dueLine = pluralCount(
    due,
    "1 thing is due today.",
    "{n} things are due today.",
  );
  if (inbox === 0) return dueLine;
  return `${dueLine} ${pluralCount(
    inbox,
    "1 task is waiting in your inbox.",
    "{n} tasks are waiting in your inbox.",
  )}`;
}

export function overviewGoalsLead(activeCount: number): string {
  if (activeCount === 0) return "No goals in progress.";
  return pluralCount(
    activeCount,
    "One goal in progress.",
    "{n} goals in progress.",
  );
}

export function overviewProjectsLead(projectCount: number): string {
  if (projectCount === 0) return "No projects yet.";
  return pluralCount(projectCount, "One project.", "{n} projects.");
}

/** Home-stack push from Overview — native slide + system back. */
export function overviewProjectHref(projectId: string): string {
  return `/project/${encodeURIComponent(projectId)}`;
}

/** Drawer destination — menu leading, not a back chevron. */
export function drawerProjectHref(projectId: string): string {
  return `/workspaces/projects/${encodeURIComponent(projectId)}?from=drawer`;
}

/**
 * Overview/home-stack and Projects-hub pushes use system back.
 * Drawer jumps use the hamburger so they do not look like a stack push.
 */
export function projectChromeLeading(
  entryFrom: ProjectEntryFrom,
): "drawer" | "back" {
  return entryFrom === "drawer" ? "drawer" : "back";
}
