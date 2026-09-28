import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { useAuth } from "@/src/auth";
import { AGENT_URL } from "@/src/eve-transport";

/** The sign-in gate: email/password through the agent's better-auth. */
export function SignInScreen() {
  const { signIn, signInState, signInError, skipSignIn } = useAuth();
  // SafeAreaView is a native codegen view — the theme background goes through
  // style, not className (uniwind can't reach it).
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const borderColor = useCSSVariable("--color-input") as string | undefined;
  const buttonColor = useCSSVariable("--color-primary") as string | undefined;
  const buttonTextColor = useCSSVariable("--color-primary-foreground") as
    | string
    | undefined;
  const hintColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <SafeAreaView style={[StyleSheet.absoluteFill, { backgroundColor }]}>
      <View style={styles.center}>
        <Text style={styles.title}>Pearl</Text>
        <Text style={[styles.hint, hintColor ? { color: hintColor } : null]}>
          {AGENT_URL}
        </Text>
        <TextInput
          style={[
            styles.input,
            borderColor ? { borderColor } : null,
            hintColor ? { color: hintColor } : null,
          ]}
          placeholder="email"
          placeholderTextColor={hintColor ?? undefined}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={[
            styles.input,
            borderColor ? { borderColor } : null,
            hintColor ? { color: hintColor } : null,
          ]}
          placeholder="password"
          placeholderTextColor={hintColor ?? undefined}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <Pressable
          style={[
            styles.button,
            buttonColor ? { backgroundColor: buttonColor } : null,
          ]}
          onPress={() => void signIn(email, password)}
        >
          <Text
            style={[
              styles.buttonText,
              buttonTextColor ? { color: buttonTextColor } : null,
            ]}
          >
            {signInState === "signing-in" ? "Signing in…" : "Sign in"}
          </Text>
        </Pressable>
        {signInError ? <Text style={styles.error}>{signInError}</Text> : null}
        <Pressable onPress={skipSignIn}>
          <Text style={[styles.skip, hintColor ? { color: hintColor } : null]}>
            Continue without sign-in (local dev)
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  title: { fontSize: 18, fontWeight: "600", textAlign: "center" },
  hint: { fontSize: 11, textAlign: "center", marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  button: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  buttonText: { fontSize: 14 },
  error: { textAlign: "center" },
  skip: {
    fontSize: 12,
    textAlign: "center",
    textDecorationLine: "underline",
  },
});
