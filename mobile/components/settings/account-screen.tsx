import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform } from "react-native";

import {
  SettingsButton,
  SettingsField,
  SettingsForm,
  SettingsFormText,
  SettingsLabeledValue,
  SettingsSection,
  SettingsSecureField,
} from "@/components/settings/native";
import { useAuth } from "@/src/auth";
import { AGENT_URL, getAuthCookie } from "@/src/eve-transport";
import { sessionInvalid } from "@/src/session-store";

/**
 * Account settings: better-auth name + email, an in-app password change,
 * and account deletion. Identity’s display name stays separate (fit / health
 * context).
 */
export function AccountScreen() {
  const { viewerEmail, viewerName, setViewerName, signOut } = useAuth();
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

  const confirmDeleteAccount = useCallback(() => {
    const run = async () => {
      try {
        const credential = getAuthCookie();
        const response = await fetch(`${AGENT_URL}/api/account`, {
          method: "DELETE",
          headers: {
            "content-type": "application/json",
            Origin: AGENT_URL,
            ...(credential ? { authorization: `Bearer ${credential}` } : {}),
          },
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? `Delete failed (${response.status}).`);
        }
        signOut();
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : "Could not delete account.";
        if (Platform.OS === "web") {
          window.alert(message);
        } else {
          Alert.alert("Could not delete account", message);
        }
      }
    };

    const title = "Delete your Pearl account?";
    const body =
      "This removes your chats, projects, and connection grants on this host. It cannot be undone.";
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(`${title}\n\n${body}`)) {
        void run();
      }
      return;
    }
    Alert.alert(title, body, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete account", style: "destructive", onPress: () => void run() },
    ]);
  }, [signOut]);

  if (!nameReady) {
    return <ActivityIndicator accessibilityLabel="Loading account" />;
  }

  return (
    <SettingsForm>
      <SettingsSection title="Profile">
        <SettingsField
          label="Name"
          onChangeText={(value) => {
            setName(value);
            setNameHint(null);
            setNameError(null);
          }}
          value={name}
        />
        <SettingsLabeledValue label="Email" value={viewerEmail ?? "—"} />
      </SettingsSection>

      {nameError ? (
        <SettingsFormText tone="destructive">{nameError}</SettingsFormText>
      ) : null}
      {nameHint ? <SettingsFormText tone="secondary">{nameHint}</SettingsFormText> : null}

      <SettingsSection>
        <SettingsButton
          disabled={nameSaving || !name.trim()}
          label={nameSaving ? "Saving…" : "Save name"}
          onPress={onSaveName}
        />
      </SettingsSection>

      <SettingsSection title="Password">
        <SettingsSecureField
          label="Current password"
          onChangeText={(value) => {
            setCurrentPassword(value);
            setPasswordHint(null);
            setPasswordError(null);
          }}
          value={currentPassword}
        />
        <SettingsSecureField
          label="New password"
          onChangeText={(value) => {
            setNewPassword(value);
            setPasswordHint(null);
            setPasswordError(null);
          }}
          value={newPassword}
        />
        <SettingsSecureField
          label="Confirm new password"
          onChangeText={(value) => {
            setConfirmPassword(value);
            setPasswordHint(null);
            setPasswordError(null);
          }}
          value={confirmPassword}
        />
      </SettingsSection>

      {passwordError ? (
        <SettingsFormText tone="destructive">{passwordError}</SettingsFormText>
      ) : null}
      {passwordHint ? (
        <SettingsFormText tone="secondary">{passwordHint}</SettingsFormText>
      ) : null}

      <SettingsSection>
        <SettingsButton
          disabled={passwordSaving}
          label={passwordSaving ? "Updating…" : "Change password"}
          onPress={onChangePassword}
        />
      </SettingsSection>

      <SettingsSection>
        <SettingsButton
          destructive
          label="Delete account"
          onPress={confirmDeleteAccount}
        />
      </SettingsSection>
    </SettingsForm>
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
