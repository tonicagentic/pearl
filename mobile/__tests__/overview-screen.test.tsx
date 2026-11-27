import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import React from "react";

const mockPush = jest.fn();
const mockNavigate = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    navigate: (...args: unknown[]) => mockNavigate(...args),
  },
  // Skip focus refetch loops so Jest can exit cleanly.
  useFocusEffect: () => {},
}));

jest.mock("uniwind", () => ({
  useCSSVariable: () => "#111111",
}));

jest.mock("@/src/auth", () => ({
  useAuth: () => ({ viewerName: "Alex Tester" }),
}));

jest.mock("@/src/network-status", () => ({
  useNetworkStatus: () => ({ offline: false }),
}));

jest.mock("@/src/track-finance-pref", () => ({
  getTrackShowFinance: () => false,
  loadTrackShowFinance: jest.fn(async () => false),
  subscribeTrackShowFinance: () => () => {},
  setTrackShowFinance: jest.fn(),
}));

jest.mock("@/components/tasks/use-tasks-actions", () => ({
  useTasksActions: () => ({
    busyId: null,
    setResolved: jest.fn(),
    deleteTask: jest.fn(),
  }),
}));

jest.mock("@/components/tasks/task-row", () => {
  const { Text } = require("react-native");
  return {
    TaskRow: ({ issue }: { issue: { title: string } }) => (
      <Text>{issue.title}</Text>
    ),
  };
});

jest.mock("@/src/issues-client", () => ({
  fetchIssues: jest.fn(async () => ({
    issues: [
      {
        id: "t1",
        title: "Ship overview",
        status: "open",
        projectId: "p1",
        dueDate: new Date().toISOString().slice(0, 10),
        description: null,
        reviewDate: null,
        state: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
        resolvedAt: null,
        areaId: "a1",
        areaName: "Work",
      },
    ],
    options: [],
    viewer: { id: "u1", name: "Alex", email: "a@example.com" },
  })),
}));

jest.mock("@/src/goals-client", () => ({
  fetchAllGoals: jest.fn(async () => [
    {
      id: "g1",
      projectId: null,
      projectName: null,
      title: "Release an EP on Apple Music and Spotify",
      status: "active",
      targetDate: "2027-02-01",
      notes: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ]),
}));

jest.mock("@/src/projects-client", () => ({
  fetchProjects: jest.fn(async () => [
    {
      id: "p1",
      name: "Personal",
      instructions: "",
      status: "backlog",
      priority: "none",
      startDate: null,
      targetDate: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.000Z",
    },
    {
      id: "p2",
      name: "test",
      instructions: "",
      status: "backlog",
      priority: "none",
      startDate: null,
      targetDate: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-15T00:00:00.000Z",
    },
  ]),
}));

jest.mock("@/src/finances-client", () => ({
  fetchMonthSpendSummary: jest.fn(),
}));

jest.mock("@/src/query-client", () => ({
  queryKeys: {
    tasks: ["tasks"],
    goals: ["goals"],
    projects: ["projects"],
    financesMonth: (year: number, month: number) => ["finances", year, month],
  },
  queryErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  showQueryErrorBanner: () => false,
}));

import { TrackScreen } from "@/components/home/track-screen";

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

describe("Overview screen UI", () => {
  let client: QueryClient;

  beforeEach(() => {
    mockPush.mockClear();
    mockNavigate.mockClear();
    client = createClient();
  });

  afterEach(() => {
    client.clear();
    screen.unmount();
  });

  it("renders greeting, narrative leads, projects, and no Automations", async () => {
    render(
      <QueryClientProvider client={client}>
        <TrackScreen />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Good (morning|afternoon|evening), Alex/)).toBeTruthy();
    });

    expect(screen.getByText("One goal in progress.")).toBeTruthy();
    expect(
      screen.getByText("Release an EP on Apple Music and Spotify"),
    ).toBeTruthy();
    expect(screen.getByText("2 projects.")).toBeTruthy();
    expect(screen.getByText("Personal")).toBeTruthy();
    expect(screen.getByText("test")).toBeTruthy();
    expect(screen.queryByText("Automations")).toBeNull();
    expect(screen.queryByText(/Schedule prompts/)).toBeNull();
    expect(screen.queryByText("Add Finance")).toBeNull();
  });

  it("opens a project on the home stack from Overview", async () => {
    render(
      <QueryClientProvider client={client}>
        <TrackScreen />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Personal")).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText(/Personal/));
    expect(mockPush).toHaveBeenCalledWith("/project/p1");
  });
});
