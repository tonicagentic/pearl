import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  createIssueRequest,
  fetchIssues,
  setIssueResolvedRequest,
  type IssueDto,
  type IssuesPayload,
} from "@/src/issues-client";

/**
 * The issues inbox on mobile: unresolved responsibilities grouped by when
 * they need attention, mirroring the web inbox (docs/issues-responsibilities-
 * plan.md). Data comes from the web app's /api/issues route over the same
 * authenticated session; responsibilities are read-only here — the tree is
 * edited on the web.
 */
export function IssuesScreen({ onClose }: { readonly onClose: () => void }) {
  const [payload, setPayload] = useState<IssuesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      setPayload(await fetchIssues());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load issues.");
    }
  }, []);

  // Initial load: state updates happen only after the fetch resolves
  // (no synchronous setState inside the effect — react-hooks lint).
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchIssues();

        if (!cancelled) {
          setPayload(data);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Failed to load issues.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const setResolved = useCallback(
    async (issue: IssueDto, resolved: boolean) => {
      setBusyId(issue.id);

      try {
        const updated = await setIssueResolvedRequest(issue.id, resolved);

        setPayload((current) =>
          current
            ? {
                ...current,
                issues: current.issues.map((row) =>
                  row.id === updated.id ? { ...row, ...updated } : row,
                ),
              }
            : current,
        );
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Failed to update the issue.");
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

  const open = (payload?.issues ?? []).filter((issue) => issue.status === "open");
  const dueSoon = open.filter((issue) => issue.state === "active" && issue.dueDate !== null);
  const later = open.filter(
    (issue) => issue.state === "active" && issue.dueDate === null,
  );
  const parked = open.filter((issue) => issue.state === "dormant");
  const resolved = (payload?.issues ?? []).filter((issue) => issue.status === "resolved");

  return (
    <ScrollView className="flex-1" contentContainerClassName="px-4 pb-24 pt-2">
      <View className="mb-4 flex-row items-center justify-between">
        <Pressable onPress={onClose} className="rounded-md px-2 py-1">
          <Text className="text-sm text-muted-foreground">‹ Chat</Text>
        </Pressable>
        <Text className="text-base font-semibold text-foreground">Issues</Text>
        <View className="w-10" />
      </View>

      {error ? (
        <View className="mb-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2">
          <Text className="text-sm text-destructive">{error}</Text>
        </View>
      ) : null}

      {!payload && !error ? (
        <ActivityIndicator />
      ) : (
        <>
          <IssueGroup
            title="Due soon"
            issues={dueSoon}
            busyId={busyId}
            onResolve={setResolved}
            empty="Nothing due soon."
          />
          <IssueGroup
            title="Later / no deadline"
            issues={later}
            busyId={busyId}
            onResolve={setResolved}
            empty="Nothing waiting."
          />

          {parked.length > 0 ? (
            <View className="mb-4 rounded-lg border bg-card">
              <Text className="px-3 py-2 text-sm font-medium text-muted-foreground">
                Parked ({parked.length})
              </Text>
              <View className="gap-2 border-t px-3 py-2">
                {parked.map((issue) => (
                  <IssueRow key={issue.id} issue={issue} busyId={busyId} onResolve={setResolved} />
                ))}
              </View>
            </View>
          ) : null}

          {resolved.length > 0 ? (
            <View className="mb-4 rounded-lg border bg-card">
              <Text className="px-3 py-2 text-sm font-medium text-muted-foreground">
                Resolved recently ({resolved.length})
              </Text>
              <View className="gap-2 border-t px-3 py-2">
                {resolved.map((issue) => (
                  <IssueRow key={issue.id} issue={issue} busyId={busyId} onResolve={setResolved} />
                ))}
              </View>
            </View>
          ) : null}

          {showForm ? (
            <NewIssueForm
              options={payload?.options ?? []}
              onDone={(created) => {
                setShowForm(false);

                if (created) {
                  void reload();
                }
              }}
            />
          ) : (
            <Pressable
              className="items-center rounded-lg border bg-card px-4 py-2.5"
              onPress={() => setShowForm(true)}
            >
              <Text className="text-sm font-medium text-foreground">+ New issue</Text>
            </Pressable>
          )}
        </>
      )}
    </ScrollView>
  );
}

function IssueGroup({
  title,
  issues,
  busyId,
  onResolve,
  empty,
}: {
  readonly title: string;
  readonly issues: readonly IssueDto[];
  readonly busyId: string | null;
  readonly onResolve: (issue: IssueDto, resolved: boolean) => Promise<void>;
  readonly empty: string;
}) {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-medium text-muted-foreground">{title}</Text>
      {issues.length === 0 ? (
        <View className="rounded-lg border bg-card px-3 py-2.5">
          <Text className="text-sm text-muted-foreground">{empty}</Text>
        </View>
      ) : (
        <View className="gap-2">
          {issues.map((issue) => (
            <IssueRow key={issue.id} issue={issue} busyId={busyId} onResolve={onResolve} />
          ))}
        </View>
      )}
    </View>
  );
}

function IssueRow({
  issue,
  busyId,
  onResolve,
}: {
  readonly issue: IssueDto;
  readonly busyId: string | null;
  readonly onResolve: (issue: IssueDto, resolved: boolean) => Promise<void>;
}) {
  const resolved = issue.status === "resolved";

  return (
    <View className="flex-row items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5">
      <View className="min-w-0 flex-1">
        <Text
          numberOfLines={2}
          className={`text-sm font-medium ${resolved ? "text-muted-foreground line-through" : "text-foreground"}`}
        >
          {issue.title}
        </Text>
        <Text className="mt-0.5 text-xs text-muted-foreground">
          {[
            issue.responsibilityName,
            issue.dueDate ? `${issue.dueDate < new Date().toISOString().slice(0, 10) ? "overdue, due" : "due"} ${issue.dueDate}` : null,
            issue.reviewDate ? `review ${issue.reviewDate}` : null,
            issue.state === "dormant" ? "parked" : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
      <Pressable
        className={`rounded-md px-2.5 py-1 ${resolved ? "border border-border" : "bg-primary"}`}
        disabled={busyId === issue.id}
        onPress={() => void onResolve(issue, !resolved)}
      >
        {busyId === issue.id ? (
          <ActivityIndicator size="small" />
        ) : (
          <Text className={`text-xs ${resolved ? "text-muted-foreground" : "text-primary-foreground"}`}>
            {resolved ? "Reopen" : "Resolve"}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

function NewIssueForm({
  options,
  onDone,
}: {
  readonly options: readonly { id: string; label: string }[];
  readonly onDone: (created: boolean) => void;
}) {
  const [title, setTitle] = useState("");
  const [responsibilityName, setResponsibilityName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <View className="gap-3 rounded-lg border bg-card px-3 py-3">
      <TextInput
        className="rounded-md border px-3 py-2 text-sm text-foreground"
        placeholder="What needs resolving?"
        placeholderTextColor="#9ca3af"
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        className="rounded-md border px-3 py-2 text-sm text-foreground"
        placeholder="Area of responsibility (e.g. Home) — optional"
        placeholderTextColor="#9ca3af"
        value={responsibilityName}
        onChangeText={setResponsibilityName}
        autoCapitalize="none"
      />
      <TextInput
        className="rounded-md border px-3 py-2 text-sm text-foreground"
        placeholder="Notes — what you're waiting on…"
        placeholderTextColor="#9ca3af"
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <View className="flex-row gap-3">
        <TextInput
          className="flex-1 rounded-md border px-3 py-2 text-sm text-foreground"
          placeholder="Due (YYYY-MM-DD)"
          placeholderTextColor="#9ca3af"
          value={dueDate}
          onChangeText={setDueDate}
          autoCapitalize="none"
        />
        <TextInput
          className="flex-1 rounded-md border px-3 py-2 text-sm text-foreground"
          placeholder="Review (YYYY-MM-DD)"
          placeholderTextColor="#9ca3af"
          value={reviewDate}
          onChangeText={setReviewDate}
          autoCapitalize="none"
        />
      </View>
      {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
      <View className="flex-row justify-end gap-2">
        <Pressable className="rounded-md px-3 py-1.5" onPress={() => onDone(false)}>
          <Text className="text-sm text-muted-foreground">Cancel</Text>
        </Pressable>
        <Pressable
          className="rounded-md bg-primary px-3 py-1.5"
          disabled={pending}
          onPress={() => {
            if (!title.trim()) {
              setError("A title is required.");
              return;
            }

            setPending(true);
            void createIssueRequest({
              title: title.trim(),
              responsibilityName: responsibilityName.trim() || undefined,
              description: description.trim() || undefined,
              dueDate: dueDate.trim() || null,
              reviewDate: reviewDate.trim() || null,
            })
              .then(() => onDone(true))
              .catch((cause: unknown) =>
                setError(cause instanceof Error ? cause.message : "Failed to create the issue."),
              )
              .finally(() => setPending(false));
          }}
        >
          {pending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="text-sm font-medium text-primary-foreground">Capture</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
