import { Pressable, View } from "react-native";
import { router } from "expo-router";
import {
  Body,
  Caption,
  Card,
  SectionLabel,
  useTheme,
} from "@/components/ui";
import { groupIssues, type IssueDto } from "@/lib/api";

function TaskRow({
  issue,
  showSeparator,
}: {
  readonly issue: IssueDto;
  readonly showSeparator: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => router.push(`/task/${encodeURIComponent(issue.id)}`)}
      style={({ pressed }) => ({
        opacity: pressed ? 0.7 : 1,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: showSeparator ? StyleSheetHairline : 0,
        borderBottomColor: theme.border,
      })}
    >
      <Body>{issue.title}</Body>
      {issue.dueDate || issue.reviewDate ? (
        <Caption>
          {[
            issue.dueDate ? `Due ${issue.dueDate}` : null,
            issue.reviewDate ? `Review ${issue.reviewDate}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Caption>
      ) : null}
    </Pressable>
  );
}

const StyleSheetHairline = 0.5;

function TaskGroup({
  label,
  issues,
}: {
  readonly label: string;
  readonly issues: readonly IssueDto[];
}) {
  if (issues.length === 0) return null;
  return (
    <View>
      <SectionLabel>
        {label} · {issues.length}
      </SectionLabel>
      <Card>
        {issues.map((issue, index) => (
          <TaskRow
            key={issue.id}
            issue={issue}
            showSeparator={index < issues.length - 1}
          />
        ))}
      </Card>
    </View>
  );
}

export function TaskList({
  issues,
  emptyLabel,
}: {
  readonly issues: readonly IssueDto[];
  readonly emptyLabel: string;
}) {
  const groups = groupIssues(issues);
  const empty =
    groups.due.length +
      groups.later.length +
      groups.parked.length +
      groups.done.length ===
    0;

  if (empty) {
    return (
      <View style={{ paddingTop: 24 }}>
        <Caption>{emptyLabel}</Caption>
      </View>
    );
  }

  return (
    <View>
      <TaskGroup label="Due" issues={groups.due} />
      <TaskGroup label="Later" issues={groups.later} />
      <TaskGroup label="Parked" issues={groups.parked} />
      <TaskGroup label="Done" issues={groups.done} />
    </View>
  );
}
