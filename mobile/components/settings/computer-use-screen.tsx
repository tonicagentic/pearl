import { useCallback, useState } from "react";
import { ActivityIndicator } from "react-native";
import { useFocusEffect } from "expo-router";

import {
  SettingsForm,
  SettingsFormText,
  SettingsPicker,
  SettingsSection,
} from "@/components/settings/native";
import {
  BROWSER_TIMEOUT_MINUTES,
  CODER_TIMEOUT_MINUTES,
  SANDBOX_VCPU_OPTIONS,
  fetchSandboxSettings,
  updateSandboxSettings,
  type SandboxSettings,
  type SandboxSettingsPatch,
} from "@/src/sandbox-settings-client";

function minutesLabel(minutes: number): string {
  return `${minutes} min`;
}

function vcpuLabel(vcpus: number): string {
  return `${vcpus} vCPU${vcpus === 1 ? "" : "s"}`;
}

/**
 * Computer Use sandbox settings. Lifetime and compute apply the next time a
 * browser or coder sandbox starts.
 */
export function ComputerUseScreen() {
  const [settings, setSettings] = useState<SandboxSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void fetchSandboxSettings()
        .then((next) => {
          if (cancelled) return;
          setSettings(next);
          setError(null);
        })
        .catch((cause: unknown) => {
          if (cancelled) return;
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load sandbox settings.",
          );
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const save = async (patch: SandboxSettingsPatch) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setSettings(await updateSandboxSettings(patch));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save sandbox settings.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsForm
      footer={
        <SettingsFormText tone="secondary">
          These apply the next time a browser or coder sandbox starts. A sandbox
          that is already open keeps its current size until it is created again.
        </SettingsFormText>
      }
    >
      {error ? (
        <SettingsFormText tone="destructive">{error}</SettingsFormText>
      ) : null}

      {settings == null && error == null ? (
        <ActivityIndicator accessibilityLabel="Loading computer use settings" />
      ) : null}

      {settings ? (
        <>
          <SettingsSection title="Browser">
            <SettingsPicker
              label="Lifetime"
              onSelectionChange={(value) => {
                const minutes = BROWSER_TIMEOUT_MINUTES.find(
                  (item) => minutesLabel(item) === value,
                );
                if (
                  minutes == null ||
                  minutes === settings.browserTimeoutMinutes
                ) {
                  return;
                }
                void save({ browserTimeoutMinutes: minutes });
              }}
              options={BROWSER_TIMEOUT_MINUTES.map(minutesLabel)}
              selection={minutesLabel(settings.browserTimeoutMinutes)}
            />
            <SettingsPicker
              label="Compute"
              onSelectionChange={(value) => {
                const vcpus = SANDBOX_VCPU_OPTIONS.find(
                  (item) => vcpuLabel(item) === value,
                );
                if (vcpus == null || vcpus === settings.browserVcpus) return;
                void save({ browserVcpus: vcpus });
              }}
              options={SANDBOX_VCPU_OPTIONS.map(vcpuLabel)}
              selection={vcpuLabel(settings.browserVcpus)}
            />
          </SettingsSection>

          <SettingsSection title="Coder">
            <SettingsPicker
              label="Lifetime"
              onSelectionChange={(value) => {
                const minutes = CODER_TIMEOUT_MINUTES.find(
                  (item) => minutesLabel(item) === value,
                );
                if (
                  minutes == null ||
                  minutes === settings.coderTimeoutMinutes
                ) {
                  return;
                }
                void save({ coderTimeoutMinutes: minutes });
              }}
              options={CODER_TIMEOUT_MINUTES.map(minutesLabel)}
              selection={minutesLabel(settings.coderTimeoutMinutes)}
            />
            <SettingsPicker
              label="Compute"
              onSelectionChange={(value) => {
                const vcpus = SANDBOX_VCPU_OPTIONS.find(
                  (item) => vcpuLabel(item) === value,
                );
                if (vcpus == null || vcpus === settings.coderVcpus) return;
                void save({ coderVcpus: vcpus });
              }}
              options={SANDBOX_VCPU_OPTIONS.map(vcpuLabel)}
              selection={vcpuLabel(settings.coderVcpus)}
            />
          </SettingsSection>
        </>
      ) : null}

      {busy ? (
        <ActivityIndicator accessibilityLabel="Saving computer use settings" />
      ) : null}
    </SettingsForm>
  );
}
