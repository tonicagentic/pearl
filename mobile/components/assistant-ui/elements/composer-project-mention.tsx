import { ProjectMark, projectMarkFor } from "@/components/project-mark";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import type { ProjectDto } from "@/src/projects-client";
import { Pressable, View } from "react-native";

/** Inline chip shown in the composer and user bubbles for a project mention. */
export function ProjectMentionChip({
  name,
  compact = false,
}: {
  readonly name: string;
  readonly compact?: boolean;
}) {
  const mark = projectMarkFor(name);
  const Glyph = mark.icon;
  const iconSize = compact ? 14 : 16;
  return (
    <View
      className={cn(
        "flex-row items-center gap-1 rounded-full bg-muted/80",
        compact ? "px-1.5 py-0.5" : "px-2 py-1",
      )}
      accessibilityLabel={`Project ${name}`}
    >
      <Glyph color={mark.color} size={iconSize} strokeWidth={2} />
      <Text
        variant="label"
        className={cn(
          "text-foreground shrink",
          compact ? "text-[13px] leading-[18px]" : "text-[15px] leading-5",
        )}
        numberOfLines={1}
      >
        {name}
      </Text>
    </View>
  );
}

export function ProjectMentionMenu({
  open,
  query,
  projects,
  loading,
  onSelect,
}: {
  readonly open: boolean;
  readonly query: string;
  readonly projects: readonly ProjectDto[];
  readonly loading: boolean;
  readonly onSelect: (project: ProjectDto) => void;
}) {
  if (!open) return null;

  const needle = query.trim().toLowerCase();
  const matches = needle
    ? projects.filter(
        (project) =>
          project.name.toLowerCase().includes(needle) ||
          project.id.toLowerCase().includes(needle),
      )
    : projects;

  return (
    <View
      pointerEvents="box-none"
      className="absolute bottom-full left-0 right-0 z-20 mb-2"
    >
      <View
        className="border-border/60 bg-card overflow-hidden rounded-[22px] border"
        style={{ borderCurve: "continuous" }}
      >
        <Text
          variant="secondary"
          className="text-muted-foreground px-3.5 pb-1.5 pt-3 text-[13px]"
        >
          Type to search projects
        </Text>
        {loading ? (
          <Text variant="secondary" className="text-muted-foreground px-3.5 pb-3 text-[14px]">
            Loading…
          </Text>
        ) : matches.length === 0 ? (
          <Text variant="secondary" className="text-muted-foreground px-3.5 pb-3 text-[14px]">
            No projects
          </Text>
        ) : (
          <View className="pb-1.5">
            {matches.slice(0, 8).map((project, index) => (
              <Pressable
                key={project.id}
                accessibilityRole="button"
                accessibilityLabel={`Mention project ${project.name}`}
                onPress={() => onSelect(project)}
                className={cn(
                  "mx-1.5 flex-row items-center gap-2.5 rounded-[14px] px-2.5 py-2.5",
                  index === 0 && "bg-foreground/5",
                )}
              >
                <ProjectMark name={project.name} size="sm" />
                <Text
                  variant="label"
                  className="text-foreground flex-1 text-[15px] leading-5"
                  numberOfLines={1}
                >
                  {project.name}
                </Text>
                <Text
                  variant="secondary"
                  className="text-muted-foreground text-[12px]"
                >
                  Project
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
