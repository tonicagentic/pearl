import type { IssueDto } from "../src/issues-client";
import {
  createDefaultsForBucket,
  issueInSmartBucket,
  issuesForSmartBucket,
  localTodayIso,
  searchIssues,
  smartListCounts,
} from "../src/task-smart-lists";

function issue(
  overrides: Partial<IssueDto> & Pick<IssueDto, "id" | "title">,
): IssueDto {
  return {
    description: null,
    status: "open",
    dueDate: null,
    reviewDate: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    resolvedAt: null,
    areaId: "a1",
    areaName: "Inbox",
    projectId: null,
    state: "active",
    ...overrides,
  };
}

const now = new Date("2026-03-15T12:00:00");

describe("task-smart-lists", () => {
  it("partitions inbox / today / upcoming / anytime / someday / logbook", () => {
    const rows = [
      issue({ id: "1", title: "Inbox undated", areaName: "Inbox" }),
      issue({
        id: "2",
        title: "Due today",
        dueDate: "2026-03-15",
        areaName: "Inbox",
      }),
      issue({
        id: "3",
        title: "Due later",
        dueDate: "2026-03-20",
        areaName: "Inbox",
      }),
      issue({
        id: "4",
        title: "Other undated",
        areaName: "Work",
      }),
      issue({
        id: "5",
        title: "Parked",
        state: "dormant",
        reviewDate: "2026-04-01",
      }),
      issue({
        id: "6",
        title: "Done",
        status: "resolved",
        state: "resolved",
        resolvedAt: "2026-03-14T00:00:00.000Z",
      }),
    ];

    expect(issuesForSmartBucket(rows, "inbox", now).map((r) => r.id)).toEqual([
      "1",
    ]);
    expect(issuesForSmartBucket(rows, "today", now).map((r) => r.id)).toEqual([
      "2",
    ]);
    expect(
      issuesForSmartBucket(rows, "upcoming", now).map((r) => r.id),
    ).toEqual(["3"]);
    expect(
      issuesForSmartBucket(rows, "anytime", now).map((r) => r.id),
    ).toEqual(["4"]);
    expect(
      issuesForSmartBucket(rows, "someday", now).map((r) => r.id),
    ).toEqual(["5"]);
    expect(
      issuesForSmartBucket(rows, "logbook", now).map((r) => r.id),
    ).toEqual(["6"]);

    expect(smartListCounts(rows, now)).toEqual({
      inbox: 1,
      today: 1,
      upcoming: 1,
      anytime: 1,
      someday: 1,
      logbook: 1,
    });
  });

  it("counts overdue into today", () => {
    const rows = [
      issue({ id: "o", title: "Overdue", dueDate: "2026-03-01" }),
    ];
    expect(issueInSmartBucket(rows[0]!, "today", now)).toBe(true);
    expect(issueInSmartBucket(rows[0]!, "upcoming", now)).toBe(false);
  });

  it("searches title and description", () => {
    const rows = [
      issue({ id: "1", title: "Buy milk", description: "Whole" }),
      issue({ id: "2", title: "Call bank" }),
    ];
    expect(searchIssues(rows, "milk").map((r) => r.id)).toEqual(["1"]);
    expect(searchIssues(rows, "BANK").map((r) => r.id)).toEqual(["2"]);
    expect(searchIssues(rows, "   ")).toEqual([]);
  });

  it("create defaults match bucket intent", () => {
    expect(createDefaultsForBucket("today", now)).toEqual({
      areaName: "Inbox",
      dueDate: localTodayIso(now),
      reviewDate: null,
    });
    const someday = createDefaultsForBucket("someday", now);
    expect(someday.dueDate).toBeNull();
    expect(someday.reviewDate && someday.reviewDate > localTodayIso(now)).toBe(
      true,
    );
    expect(createDefaultsForBucket("anytime", now).areaName).toBe("Home");
  });
});
