import { useState, useSyncExternalStore } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { SheetScaffold } from "@/components/sheet-scaffold";
import {
  COMPOSER_MODEL_SECTIONS,
  getModelSelection,
  setModelSelection,
  subscribeModelSelection,
} from "@/src/model-selection";

const IOS_TINT = "#007AFF";

/**
 * Default model picker. Models power each inference call; Pearl the agent
 * still decides which tools to use and how to loop across steps.
 */
export function ModelsScreen() {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const selectedKey = useSyncExternalStore(
    subscribeModelSelection,
    getModelSelection,
    getModelSelection,
  );
  const cardColor = useCSSVariable("--color-card") as string | undefined;
  const separatorColor = useCSSVariable("--color-border") as string | undefined;

  const selectModel = (key: string) => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    void setModelSelection(key)
      .catch(() => {
        setSaveError("Couldn't save this choice. Tap it again to retry.");
      })
      .finally(() => setSaving(false));
  };

  return (
    <SheetScaffold
      title="Models"
      footer={
        <Text className="px-1 text-[13px] leading-[18px] text-muted-foreground">
          A model runs inference for each reply. Pearl is the agent around it —
          tools, skills, plugins, and multi-step loops. This default applies to
          new turns; change it in the composer for a single message.
        </Text>
      }
    >
      {COMPOSER_MODEL_SECTIONS.map((section) => (
        <View key={section.id} className="gap-1.5">
          <View className="px-1">
            <Text className="text-[13px] font-normal uppercase tracking-[0.04em] text-muted-foreground">
              {section.title}
            </Text>
            {section.description ? (
              <Text className="mt-1 text-[13px] leading-[18px] text-muted-foreground">
                {section.description}
              </Text>
            ) : null}
          </View>
          <View
            className="overflow-hidden rounded-[10px]"
            style={{ backgroundColor: cardColor ?? "#fff" }}
          >
            {section.models.map((model, index) => {
              const selected = selectedKey === model.key;
              return (
                <View key={model.key}>
                  {index > 0 ? (
                    <View
                      style={[
                        styles.separator,
                        {
                          backgroundColor:
                            separatorColor ?? "rgba(60,60,67,0.29)",
                        },
                      ]}
                    />
                  ) : null}
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityLabel={model.label}
                    accessibilityState={{ checked: selected, disabled: saving }}
                    className="active:bg-muted/80"
                    disabled={saving}
                    onPress={() => selectModel(model.key)}
                    style={styles.row}
                  >
                    <View className="min-w-0 flex-1 gap-0.5">
                      <Text className="text-[17px] leading-[22px] text-foreground">
                        {model.label}
                      </Text>
                      <Text className="text-[13px] leading-[18px] text-muted-foreground">
                        {`by ${model.company}`}
                      </Text>
                      {model.openWeight ? (
                        <View className="mt-0.5 self-start rounded-full bg-muted px-2 py-0.5">
                          <Text className="text-[11px] font-medium text-muted-foreground">
                            Open Weight
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {selected ? <Text style={styles.check}>✓</Text> : null}
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      ))}

      {saveError ? (
        <Text
          accessibilityRole="alert"
          className="px-1 text-[13px] text-destructive"
        >
          {saveError}
        </Text>
      ) : null}
    </SheetScaffold>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  separator: {
    marginLeft: 16,
    height: StyleSheet.hairlineWidth,
  },
  check: {
    color: IOS_TINT,
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 22,
  },
});
