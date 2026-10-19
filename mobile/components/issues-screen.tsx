import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import {
  createIssueRequest,
  fetchIssues,
  setIssueResolvedRequest,
  type IssueDto,
  type IssuesPayload,
} from "@/src/issues-client";

/**
 * The issues inbox on mobile: unresolved areas grouped by when
 * they need attention, mirroring the web inbox (docs/issues-areas-
 * plan.md). Data comes from the web app's /api/issues route over the same
 * authenticated session; areas are read-only here — the tree is
 * edited on the web.
 */
export function IssuesScreen() {
  const [payload, setPayload] = useState<IssuesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // SafeAreaView is a native codegen view — the theme background goes through
  // style, not className (uniwind can't reach it).
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

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
    // The native stack header handles the top inset; scroll content owns its bottom padding.
    <SafeAreaView
      style={{ flex: 1, backgroundColor }}
      edges={["left", "right"]}
    >

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-24"
      >

      {error ? (
        <View className="mb-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2">
          <Text className="text-sm text-destructive">{error}</Text>
        </View>
      ) : null}

      {!payload && !error ? (
        <ActivityIndicator color={placeholderColor ?? undefined} />
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
              accessibilityRole="button"
              className="min-h-12 items-center justify-center rounded-lg border bg-card px-4"
              onPress={() => setShowForm(true)}
            >
              <Text className="text-sm font-medium text-foreground">+ New issue</Text>
            </Pressable>
          )}
        </>
      )}
      </ScrollView>
    </SafeAreaView>
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
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

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
            issue.areaName,
            issue.dueDate ? `${issue.dueDate < new Date().toISOString().slice(0, 10) ? "overdue, due" : "due"} ${issue.dueDate}` : null,
            issue.reviewDate ? `review ${issue.reviewDate}` : null,
            issue.state === "dormant" ? "parked" : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${resolved ? "Reopen" : "Resolve"} ${issue.title}`}
        className={`min-h-11 min-w-11 items-center justify-center rounded-md px-3 ${resolved ? "border border-border" : "bg-primary"}`}
        disabled={busyId === issue.id}
        onPress={() => void onResolve(issue, !resolved)}
      >
        {busyId === issue.id ? (
          <ActivityIndicator size="small" color={placeholderColor ?? undefined} />
        ) : (
          <Text className={`text-xs ${resolved ? "text-muted-foreground" : "text-primary-foreground"}`}>
            {resolved ? "Reopen" : "Resolve"}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

// Use local calendar components rather than UTC serialization (which shifts days).
function formatDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function DateField({ label, value, onChange }: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const backgroundColor = useCSSVariable("--color-background") as string | undefined;
  const selected = value ? new Date(`${value}T12:00:00`) : new Date();
  const picker = open ? (
    <DateTimePicker
      value={selected}
      mode="date"
      display={Platform.OS === "ios" ? "inline" : "default"}
      presentation={Platform.OS === "ios" ? "inline" : "dialog"}
      onValueChange={(_event, date) => {
        onChange(formatDay(date));
        if (Platform.OS !== "ios") setOpen(false);
      }}
      onDismiss={() => setOpen(false)}
    />
  ) : null;

  return (
    <View className="flex-1">
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} date, ${value || "none"}`} className="min-h-12 justify-center rounded-md border px-3" onPress={() => setOpen(true)}>
        <Text className="text-sm text-foreground">{label}: {value || "Choose date"}</Text>
      </Pressable>
      {Platform.OS === "ios" ? (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <View className="flex-1 justify-end bg-black/40">
            <View style={{ backgroundColor }} className="rounded-t-2xl px-4 pb-8 pt-4">
              <Text className="text-lg font-semibold text-foreground">{label} date</Text>
              {picker}
              <View className="flex-row justify-between">
                <Pressable accessibilityRole="button" className="min-h-11 justify-center px-4" onPress={() => { onChange(""); setOpen(false); }}><Text className="text-foreground">Clear</Text></Pressable>
                <Pressable accessibilityRole="button" className="min-h-11 justify-center px-4" onPress={() => setOpen(false)}><Text className="text-foreground">Done</Text></Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : picker}
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
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  const primaryForeground = useCSSVariable("--color-primary-foreground") as
    | string
    | undefined;
  const [areaName, setAreaName] = useState("");
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
        placeholderTextColor={placeholderColor ?? undefined}
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        className="rounded-md border px-3 py-2 text-sm text-foreground"
        placeholder="Area of area (e.g. Home) — optional"
        placeholderTextColor={placeholderColor ?? undefined}
        value={areaName}
        onChangeText={setAreaName}
        autoCapitalize="none"
      />
      <TextInput
        className="rounded-md border px-3 py-2 text-sm text-foreground"
        placeholder="Notes — what you're waiting on…"
        placeholderTextColor={placeholderColor ?? undefined}
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <View className="flex-row gap-3">
        <DateField label="Due" value={dueDate} onChange={setDueDate} />
        <DateField label="Review" value={reviewDate} onChange={setReviewDate} />
      </View>
      {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
      <View className="flex-row justify-end gap-2">
        <Pressable accessibilityRole="button" className="min-h-11 justify-center rounded-md px-3" onPress={() => onDone(false)}>
          <Text className="text-sm text-muted-foreground">Cancel</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          className="min-h-11 justify-center rounded-md bg-primary px-3"
          disabled={pending}
          onPress={() => {
            if (!title.trim()) {
              setError("A title is required.");
              return;
            }

            setPending(true);
            void createIssueRequest({
              title: title.trim(),
              areaName: areaName.trim() || undefined,
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
            <ActivityIndicator size="small" color={primaryForeground ?? "#fff"} />
          ) : (
            <Text className="text-sm font-medium text-primary-foreground">Capture</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
