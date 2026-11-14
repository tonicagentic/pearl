import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Platform, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { MonitorIcon, TimerIcon } from "lucide-react-native";

import { SheetScaffold } from "@/components/settings/sheet-scaffold";
import { Icon } from "@/components/ui/icon";
import { Section } from "@/components/ui/section";
import { SettingsRow } from "@/components/ui/settings-row";
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

function chooseNumber(
  title: string,
  options: readonly number[],
  label: (value: number) => string,
): Promise<number | null> {
  if (Platform.OS === "web") {
    const answer =
      typeof window !== "undefined"
        ? window.prompt(
            `${title}\n\n${options.map((value) => label(value)).join(", ")}`,
          )
        : null;
    if (!answer) return Promise.resolve(null);
    const match = options.find(
      (value) => label(value) === answer.trim() || String(value) === answer.trim(),
    );
    return Promise.resolve(match ?? null);
  }
  return new Promise((resolve) => {
    Alert.alert(title, undefined, [
      ...options.map((value) => ({
        text: label(value),
        onPress: () => resolve(value),
      })),
      { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
    ]);
  });
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

  const pick = async (
    title: string,
    options: readonly number[],
    label: (value: number) => string,
    key: keyof SandboxSettingsPatch,
    current: number,
  ) => {
    const value = await chooseNumber(title, options, label);
    if (value == null || value === current) return;
    await save({ [key]: value });
  };

  return (
    <SheetScaffold>
      {error ? (
        <Text className="px-1 text-[15px] leading-5 text-destructive">
          {error}
        </Text>
      ) : null}

      {settings == null && error == null ? (
        <View className="min-h-24 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : null}

      {settings ? (
        <>
          <Section title="Browser">
            <SettingsRow
              icon={<Icon as={TimerIcon} className="size-5 text-sky-600" />}
              label="Lifetime"
              detail={minutesLabel(settings.browserTimeoutMinutes)}
              onPress={() =>
                void pick(
                  "Browser lifetime",
                  BROWSER_TIMEOUT_MINUTES,
                  minutesLabel,
                  "browserTimeoutMinutes",
                  settings.browserTimeoutMinutes,
                )
              }
              showSeparator
            />
            <SettingsRow
              icon={<Icon as={MonitorIcon} className="size-5 text-sky-600" />}
              label="Compute"
              detail={vcpuLabel(settings.browserVcpus)}
              onPress={() =>
                void pick(
                  "Browser compute",
                  SANDBOX_VCPU_OPTIONS,
                  vcpuLabel,
                  "browserVcpus",
                  settings.browserVcpus,
                )
              }
            />
          </Section>

          <Section title="Coder">
            <SettingsRow
              icon={<Icon as={TimerIcon} className="size-5 text-emerald-600" />}
              label="Lifetime"
              detail={minutesLabel(settings.coderTimeoutMinutes)}
              onPress={() =>
                void pick(
                  "Coder lifetime",
                  CODER_TIMEOUT_MINUTES,
                  minutesLabel,
                  "coderTimeoutMinutes",
                  settings.coderTimeoutMinutes,
                )
              }
              showSeparator
            />
            <SettingsRow
              icon={<Icon as={MonitorIcon} className="size-5 text-emerald-600" />}
              label="Compute"
              detail={vcpuLabel(settings.coderVcpus)}
              onPress={() =>
                void pick(
                  "Coder compute",
                  SANDBOX_VCPU_OPTIONS,
                  vcpuLabel,
                  "coderVcpus",
                  settings.coderVcpus,
                )
              }
            />
          </Section>

          <Text className="px-1 text-[13px] leading-[18px] text-muted-foreground">
            These apply the next time a browser or coder sandbox starts. A
            sandbox that is already open keeps its current size until it is
            created again.
          </Text>
        </>
      ) : null}

      {busy ? (
        <View className="items-center">
          <ActivityIndicator />
        </View>
      ) : null}
    </SheetScaffold>
  );
}
