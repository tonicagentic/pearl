import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { useAuth } from "@/src/auth";
import { AGENT_URL } from "@/src/eve-transport";

/** The sign-in gate: email/password through the agent's better-auth. */
export function SignInScreen() {
  const { signIn, signInState, signInError, skipSignIn } = useAuth();
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <SafeAreaView style={[StyleSheet.absoluteFill, { backgroundColor }]}>
      <StatusBar style="auto" />
      <View style={styles.center}>
        <Text style={styles.title}>Pearl</Text>
        <Text style={styles.hint}>{AGENT_URL}</Text>
        <TextInput
          style={styles.input}
          placeholder="email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <Pressable style={styles.button} onPress={() => void signIn(email, password)}>
          <Text style={styles.buttonText}>
            {signInState === "signing-in" ? "Signing in…" : "Sign in"}
          </Text>
        </Pressable>
        {signInError ? <Text style={styles.error}>{signInError}</Text> : null}
        <Pressable onPress={skipSignIn}>
          <Text style={styles.skip}>Continue without sign-in (local dev)</Text>
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
  hint: { fontSize: 11, color: "#777", textAlign: "center", marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#d4d4d8",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  button: {
    backgroundColor: "#18181b",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  buttonText: { color: "#fff" },
  error: { color: "#b91c1c", textAlign: "center" },
  skip: { color: "#777", textAlign: "center", textDecorationLine: "underline" },
});
