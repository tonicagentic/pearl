import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { SheetScaffold } from "@/components/settings/sheet-scaffold";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { cn } from "@/lib/utils";
import { useAuth } from "@/src/auth";
import { AGENT_URL, getAuthCookie } from "@/src/eve-transport";
import { sessionInvalid } from "@/src/session-store";

/**
 * Account settings: better-auth name + email, and an in-app password change.
 * Identity’s display name stays separate (fit / health context).
 */
export function AccountScreen() {
  const { viewerEmail, viewerName, setViewerName } = useAuth();
  const [name, setName] = useState(viewerName ?? "");
  const [nameReady, setNameReady] = useState(Boolean(viewerName));
  const [nameSaving, setNameSaving] = useState(false);
  const [nameHint, setNameHint] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordHint, setPasswordHint] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (viewerName != null) {
      setName(viewerName);
      setNameReady(true);
    }
  }, [viewerName]);

  useEffect(() => {
    if (nameReady || !viewerEmail) return;
    // Cold start: name may still be loading; seed from email local-part so the
    // field is not blank while get-session finishes.
    setName((current) => current || viewerEmail.split("@")[0] || "");
    setNameReady(true);
  }, [nameReady, viewerEmail]);

  const onSaveName = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed || nameSaving) return;
    setNameSaving(true);
    setNameError(null);
    setNameHint(null);
    void (async () => {
      try {
        const credential = getAuthCookie();
        const response = await fetch(`${AGENT_URL}/api/auth/update-user`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(credential ? { authorization: `Bearer ${credential}` } : {}),
          },
          body: JSON.stringify({ name: trimmed }),
        });
        if (response.status === 401) {
          sessionInvalid();
          throw new Error("Signed out. Sign in again.");
        }
        if (!response.ok) {
          throw new Error(await authErrorMessage(response, "Could not save name."));
        }
        setViewerName(trimmed);
        setName(trimmed);
        setNameHint("Saved.");
      } catch (cause) {
        setNameError(
          cause instanceof Error ? cause.message : "Could not save name.",
        );
      } finally {
        setNameSaving(false);
      }
    })();
  }, [name, nameSaving, setViewerName]);

  const onChangePassword = useCallback(() => {
    if (passwordSaving) return;
    setPasswordError(null);
    setPasswordHint(null);
    if (newPassword.length < 8) {
      setPasswordError("Use at least 8 characters for your password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don’t match.");
      return;
    }
    if (!currentPassword) {
      setPasswordError("Enter your current password.");
      return;
    }
    setPasswordSaving(true);
    void (async () => {
      try {
        const credential = getAuthCookie();
        const response = await fetch(`${AGENT_URL}/api/auth/change-password`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(credential ? { authorization: `Bearer ${credential}` } : {}),
          },
          body: JSON.stringify({
            currentPassword,
            newPassword,
          }),
        });
        if (response.status === 401) {
          sessionInvalid();
          throw new Error("Signed out. Sign in again.");
        }
        if (!response.ok) {
          throw new Error(
            await authErrorMessage(response, "Could not change password."),
          );
        }
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setPasswordHint("Password updated.");
      } catch (cause) {
        setPasswordError(
          cause instanceof Error ? cause.message : "Could not change password.",
        );
      } finally {
        setPasswordSaving(false);
      }
    })();
  }, [confirmPassword, currentPassword, newPassword, passwordSaving]);

  return (
    <SheetScaffold>
      {!nameReady ? (
        <ActivityIndicator accessibilityLabel="Loading account" />
      ) : (
        <View className="gap-5">
          <FieldGroup label="Profile">
            <TextRow
              autoCapitalize="words"
              label="Name"
              onChangeText={(value) => {
                setName(value);
                setNameHint(null);
                setNameError(null);
              }}
              value={name}
            />
            <ReadOnlyRow label="Email" last value={viewerEmail ?? "—"} />
          </FieldGroup>

          {nameError ? (
            <Text
              variant="secondary"
              tone="destructive"
              className="px-1"
              accessibilityRole="alert"
            >
              {nameError}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            className="min-h-11 items-center justify-center overflow-hidden rounded-[10px] bg-card active:opacity-80"
            disabled={nameSaving || !name.trim()}
            onPress={onSaveName}
          >
            <Text variant="label" weight="semibold">
              {nameSaving ? "Saving…" : "Save name"}
            </Text>
          </Pressable>

          {nameHint ? (
            <Text variant="secondary" className="px-1 text-center">
              {nameHint}
            </Text>
          ) : null}

          <FieldGroup label="Password">
            <TextRow
              autoCapitalize="none"
              label="Current password"
              onChangeText={(value) => {
                setCurrentPassword(value);
                setPasswordHint(null);
                setPasswordError(null);
              }}
              secureTextEntry
              value={currentPassword}
            />
            <TextRow
              autoCapitalize="none"
              label="New password"
              onChangeText={(value) => {
                setNewPassword(value);
                setPasswordHint(null);
                setPasswordError(null);
              }}
              secureTextEntry
              value={newPassword}
            />
            <TextRow
              autoCapitalize="none"
              label="Confirm new password"
              last
              onChangeText={(value) => {
                setConfirmPassword(value);
                setPasswordHint(null);
                setPasswordError(null);
              }}
              secureTextEntry
              value={confirmPassword}
            />
          </FieldGroup>

          {passwordError ? (
            <Text
              variant="secondary"
              tone="destructive"
              className="px-1"
              accessibilityRole="alert"
            >
              {passwordError}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            className="min-h-11 items-center justify-center overflow-hidden rounded-[10px] bg-card active:opacity-80"
            disabled={passwordSaving}
            onPress={onChangePassword}
          >
            <Text variant="label" weight="semibold">
              {passwordSaving ? "Updating…" : "Change password"}
            </Text>
          </Pressable>

          {passwordHint ? (
            <Text variant="secondary" className="px-1 text-center">
              {passwordHint}
            </Text>
          ) : null}
        </View>
      )}
    </SheetScaffold>
  );
}

async function authErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const body = (await response.json()) as {
      message?: string;
      error?: { message?: string } | string;
    };
    if (typeof body.error === "string" && body.error.trim()) return body.error;
    if (
      body.error &&
      typeof body.error === "object" &&
      typeof body.error.message === "string" &&
      body.error.message.trim()
    ) {
      return body.error.message;
    }
    if (typeof body.message === "string" && body.message.trim()) {
      return body.message;
    }
  } catch {
    // keep fallback
  }
  return fallback;
}

function FieldGroup({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <View className="gap-1.5">
      <Text variant="secondary" className="px-1 uppercase tracking-[0.04em]">
        {label}
      </Text>
      <View className="overflow-hidden rounded-[10px] bg-card">{children}</View>
    </View>
  );
}

function TextRow({
  label,
  value,
  onChangeText,
  placeholder,
  last = false,
  secureTextEntry = false,
  autoCapitalize = "sentences",
}: {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly placeholder?: string;
  readonly last?: boolean;
  readonly secureTextEntry?: boolean;
  readonly autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  return (
    <View
      className={cn("gap-2 px-4 pt-2.5 pb-3", !last && "border-b border-border")}
    >
      <Text variant="secondary">{label}</Text>
      <TextField
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        style={styles.inlineField}
        textContentType={secureTextEntry ? "password" : "name"}
        value={value}
      />
    </View>
  );
}

function ReadOnlyRow({
  label,
  value,
  last = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly last?: boolean;
}) {
  return (
    <View
      className={cn("gap-2 px-4 pt-2.5 pb-3", !last && "border-b border-border")}
    >
      <Text variant="secondary">{label}</Text>
      <Text variant="label" className="py-2">
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  inlineField: {
    backgroundColor: "transparent",
    borderWidth: 0,
    height: 40,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
});
