import { useCallback, useState } from "react";
import { LayoutAnimation, Platform, UIManager } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import {
  deleteIssueRequest,
  setIssueResolvedRequest,
  type IssueDto,
  type IssuesPayload,
} from "@/src/issues-client";
import { useNetworkStatus } from "@/src/network-status";
import {
  queryErrorMessage,
  queryKeys,
  showQueryErrorBanner,
} from "@/src/query-client";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function animateList() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

/** Shared mutate helpers for Tasks home + smart-list screens. */
export function useTasksActions() {
  const queryClient = useQueryClient();
  const { offline } = useNetworkStatus();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const patchIssue = useCallback(
    (updated: IssueDto) => {
      animateList();
      queryClient.setQueryData<IssuesPayload>(queryKeys.tasks, (current) =>
        current
          ? {
              ...current,
              issues: current.issues.map((row) =>
                row.id === updated.id ? { ...row, ...updated } : row,
              ),
            }
          : current,
      );
    },
    [queryClient],
  );

  const prependIssue = useCallback(
    (created: IssueDto) => {
      animateList();
      // Normalize date fields — API JSON may leave Date-shaped values.
      const normalized: IssueDto = {
        ...created,
        createdAt:
          typeof created.createdAt === "string"
            ? created.createdAt
            : new Date(created.createdAt as unknown as string).toISOString(),
        resolvedAt:
          created.resolvedAt == null
            ? null
            : typeof created.resolvedAt === "string"
              ? created.resolvedAt
              : new Date(
                  created.resolvedAt as unknown as string,
                ).toISOString(),
        state: created.state ?? (created.status === "resolved" ? "resolved" : "active"),
      };
      queryClient.setQueryData<IssuesPayload>(queryKeys.tasks, (current) => {
        if (!current) {
          return {
            viewer: { id: "", name: "", email: "" },
            issues: [normalized],
            options: [],
          };
        }
        if (current.issues.some((row) => row.id === normalized.id)) {
          return current;
        }
        return { ...current, issues: [normalized, ...current.issues] };
      });
      // Soft refresh later — avoid racing the optimistic row out of the list.
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
      }, 800);
    },
    [queryClient],
  );

  const removeIssue = useCallback(
    (id: string) => {
      animateList();
      queryClient.setQueryData<IssuesPayload>(queryKeys.tasks, (current) =>
        current
          ? {
              ...current,
              issues: current.issues.filter((row) => row.id !== id),
            }
          : current,
      );
    },
    [queryClient],
  );

  const setResolved = useCallback(
    (issue: IssueDto, resolved: boolean) => {
      setBusyId(issue.id);
      setActionError(null);
      const optimistic: IssueDto = {
        ...issue,
        status: resolved ? "resolved" : "open",
        state: resolved ? "resolved" : "active",
        resolvedAt: resolved ? new Date().toISOString() : null,
      };
      patchIssue(optimistic);
      void (async () => {
        try {
          const updated = await setIssueResolvedRequest(issue.id, resolved);
          patchIssue(updated);
          void queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
        } catch (cause) {
          patchIssue(issue);
          if (showQueryErrorBanner(offline, cause)) {
            setActionError(
              queryErrorMessage(cause, "Failed to update the task."),
            );
          }
        } finally {
          setBusyId(null);
        }
      })();
    },
    [offline, patchIssue, queryClient],
  );

  const deleteTask = useCallback(
    (issue: IssueDto) => {
      void (async () => {
        setBusyId(issue.id);
        setActionError(null);
        const snapshot = queryClient.getQueryData<IssuesPayload>(
          queryKeys.tasks,
        );
        removeIssue(issue.id);
        try {
          await deleteIssueRequest(issue.id);
          void queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
        } catch (cause) {
          if (snapshot) {
            queryClient.setQueryData(queryKeys.tasks, snapshot);
          }
          if (showQueryErrorBanner(offline, cause)) {
            setActionError(
              queryErrorMessage(cause, "Failed to delete the task."),
            );
          }
        } finally {
          setBusyId(null);
        }
      })();
    },
    [offline, queryClient, removeIssue],
  );

  return {
    busyId,
    actionError,
    setActionError,
    patchIssue,
    prependIssue,
    setResolved,
    deleteTask,
  };
}
