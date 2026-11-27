import { HOME_TAB_LABEL } from "@/components/home/home-tab";
import {
  drawerProjectHref,
  firstNameFrom,
  overviewDateLabel,
  overviewGoalsLead,
  overviewGreeting,
  overviewProjectHref,
  overviewProjectsLead,
  overviewTasksLead,
  projectChromeLeading,
} from "@/src/overview-ui";

describe("Overview home tab contracts", () => {
  it("labels the home switcher Overview (not Track)", () => {
    expect(HOME_TAB_LABEL.pearl).toBe("Chat");
    expect(HOME_TAB_LABEL.track).toBe("Overview");
  });

  it("greets by time of day and first name", () => {
    expect(firstNameFrom("Alex Rivera")).toBe("Alex");
    expect(firstNameFrom("  ")).toBeNull();
    expect(overviewGreeting(new Date("2026-11-26T09:00:00"), "Alex")).toBe(
      "Good morning, Alex",
    );
    expect(overviewGreeting(new Date("2026-11-26T14:00:00"), null)).toBe(
      "Good afternoon",
    );
    expect(overviewGreeting(new Date("2026-11-26T19:00:00"), "Alex")).toBe(
      "Good evening, Alex",
    );
  });

  it("formats the overview date without a year", () => {
    const label = overviewDateLabel(new Date("2026-11-26T12:00:00"));
    expect(label).toContain("November");
    expect(label).toContain("26");
    expect(label).not.toMatch(/2026/);
  });

  it("builds narrative leads for tasks, goals, and projects", () => {
    expect(overviewTasksLead({ dueToday: 0, inbox: 0 })).toBe(
      "Nothing is due today.",
    );
    expect(overviewTasksLead({ dueToday: 0, inbox: 3 })).toBe(
      "Nothing is due today. 3 tasks are waiting in your inbox.",
    );
    expect(overviewTasksLead({ dueToday: 2, inbox: 1 })).toBe(
      "2 things are due today. 1 task is waiting in your inbox.",
    );
    expect(overviewGoalsLead(0)).toBe("No goals in progress.");
    expect(overviewGoalsLead(1)).toBe("One goal in progress.");
    expect(overviewGoalsLead(3)).toBe("3 goals in progress.");
    expect(overviewProjectsLead(0)).toBe("No projects yet.");
    expect(overviewProjectsLead(1)).toBe("One project.");
    expect(overviewProjectsLead(2)).toBe("2 projects.");
  });

  it("pushes Overview projects onto the home stack", () => {
    expect(overviewProjectHref("abc 1")).toBe("/project/abc%201");
  });

  it("opens drawer projects as workspaces destinations with from=drawer", () => {
    expect(drawerProjectHref("p1")).toBe(
      "/workspaces/projects/p1?from=drawer",
    );
  });

  it("uses menu leading for drawer entry and system back otherwise", () => {
    expect(projectChromeLeading("drawer")).toBe("drawer");
    expect(projectChromeLeading("overview")).toBe("back");
    expect(projectChromeLeading(undefined)).toBe("back");
  });
});
