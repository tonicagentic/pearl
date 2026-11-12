import { useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { useCSSVariable } from "uniwind";

function formatDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Due / review date chip with an inline or dialog picker. */
export function TaskDateField({
  label,
  value,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} date, ${value || "none"}`}
        className="min-h-12 justify-center rounded-2xl bg-muted/50 px-3"
        onPress={() => setOpen(true)}
      >
        <Text className="text-[12px] text-muted-foreground">{label}</Text>
        <Text className="mt-0.5 text-[15px] text-foreground">
          {value || "None"}
        </Text>
      </Pressable>
      {Platform.OS === "ios" ? (
        <Modal
          visible={open}
          transparent
          animationType="slide"
          onRequestClose={() => setOpen(false)}
        >
          <View className="flex-1 justify-end bg-foreground/40">
            <View
              style={{ backgroundColor }}
              className="rounded-t-3xl px-4 pb-8 pt-4"
            >
              <Text className="mb-2 text-lg font-semibold text-foreground">
                {label}
              </Text>
              {picker}
              <View className="mt-2 flex-row justify-between">
                <Pressable
                  accessibilityRole="button"
                  className="min-h-11 justify-center px-4"
                  onPress={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  <Text className="text-foreground">Clear</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  className="min-h-11 justify-center px-4"
                  onPress={() => setOpen(false)}
                >
                  <Text className="font-medium text-foreground">Done</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : (
        picker
      )}
    </View>
  );
}
