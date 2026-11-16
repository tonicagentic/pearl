import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Button, Caption, Field, Screen } from "@/components/ui";
import { createProject } from "@/lib/api";

export default function NewProjectScreen() {
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    void createProject({
      name: name.trim(),
      instructions: instructions.trim(),
    })
      .then((project) => {
        router.replace(`/project/${encodeURIComponent(project.id)}`);
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Could not create.");
        setBusy(false);
      });
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <Field
            autoFocus
            placeholder="Project name"
            value={name}
            onChangeText={setName}
          />
          <Field
            multiline
            placeholder="Instructions (optional)"
            value={instructions}
            onChangeText={setInstructions}
            style={{ minHeight: 120, textAlignVertical: "top" }}
          />
          {error ? <Caption>{error}</Caption> : null}
          <View style={{ marginTop: 8 }}>
            <Button
              label={busy ? "Creating…" : "Create project"}
              onPress={submit}
              disabled={busy || !name.trim()}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
