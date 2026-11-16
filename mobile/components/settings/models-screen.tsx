import { useState, useSyncExternalStore } from "react";

import {
  SettingsForm,
  SettingsFormText,
  SettingsPicker,
  SettingsSection,
} from "@/components/settings/native";
import {
  COMPOSER_MODEL_SECTIONS,
  getImageModelSelection,
  getModelSelection,
  getVectorModelSelection,
  IMAGE_MODEL_SECTION,
  setImageModelSelection,
  setModelSelection,
  setVectorModelSelection,
  subscribeImageModelSelection,
  subscribeModelSelection,
  subscribeVectorModelSelection,
  VECTOR_MODEL_SECTION,
  type ComposerModelSection,
} from "@/src/model-selection";

/**
 * Default model picker. Models power each inference call; Pearl the agent
 * still decides which tools to use and how to loop across steps. Image and
 * vector models are separate radio groups for generate_image / generate_svg.
 */
export function ModelsScreen() {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const selectedKey = useSyncExternalStore(
    subscribeModelSelection,
    getModelSelection,
    getModelSelection,
  );
  const selectedImageKey = useSyncExternalStore(
    subscribeImageModelSelection,
    getImageModelSelection,
    getImageModelSelection,
  );
  const selectedVectorKey = useSyncExternalStore(
    subscribeVectorModelSelection,
    getVectorModelSelection,
    getVectorModelSelection,
  );

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

  const selectImageModel = (key: string) => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    void setImageModelSelection(key)
      .catch(() => {
        setSaveError("Couldn't save this choice. Tap it again to retry.");
      })
      .finally(() => setSaving(false));
  };

  const selectVectorModel = (key: string) => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    void setVectorModelSelection(key)
      .catch(() => {
        setSaveError("Couldn't save this choice. Tap it again to retry.");
      })
      .finally(() => setSaving(false));
  };

  return (
    <SettingsForm
      footer={
        <SettingsFormText tone="secondary">
          A model runs inference for each reply. Pearl is the agent around it —
          tools, skills, plugins, and multi-step loops. This default applies to
          new turns; change it in the composer for a single message.
        </SettingsFormText>
      }
    >
      {COMPOSER_MODEL_SECTIONS.map((section) => (
        <ModelSection
          key={section.id}
          section={section}
          selectedKey={selectedKey}
          onSelect={selectModel}
        />
      ))}

      <ModelSection
        section={IMAGE_MODEL_SECTION}
        selectedKey={selectedImageKey}
        onSelect={selectImageModel}
      />

      <ModelSection
        section={VECTOR_MODEL_SECTION}
        selectedKey={selectedVectorKey}
        onSelect={selectVectorModel}
      />

      {saveError ? (
        <SettingsFormText tone="destructive">{saveError}</SettingsFormText>
      ) : null}
    </SettingsForm>
  );
}

function ModelSection({
  section,
  selectedKey,
  onSelect,
}: {
  readonly section: ComposerModelSection;
  readonly selectedKey: string;
  readonly onSelect: (key: string) => void;
}) {
  const labels = section.models.map((model) =>
    model.openWeight ? `${model.label} (Open Weight)` : model.label,
  );
  const selectedModel =
    section.models.find((model) => model.key === selectedKey) ??
    section.models[0];
  const selectionLabel = selectedModel
    ? selectedModel.openWeight
      ? `${selectedModel.label} (Open Weight)`
      : selectedModel.label
    : labels[0] ?? "";

  return (
    <SettingsSection
      title={section.title}
      footer={
        section.description ? (
          <SettingsFormText tone="secondary">{section.description}</SettingsFormText>
        ) : undefined
      }
    >
      <SettingsPicker
        label="Model"
        onSelectionChange={(label) => {
          const model = section.models.find((item) => {
            const itemLabel = item.openWeight
              ? `${item.label} (Open Weight)`
              : item.label;
            return itemLabel === label;
          });
          if (model) onSelect(model.key);
        }}
        options={labels}
        selection={selectionLabel}
      />
      {selectedModel ? (
        <SettingsFormText tone="secondary">
          {`by ${selectedModel.company}`}
        </SettingsFormText>
      ) : null}
    </SettingsSection>
  );
}
