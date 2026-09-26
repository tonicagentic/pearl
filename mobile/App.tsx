import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSyncExternalStore } from 'react';
import {
  AssistantRuntimeProvider,
  AuiConfig,
  fromThreadMessageLike,
  Suggestions,
  useExternalStoreRuntime,
  type ThreadMessageLike,
} from '@assistant-ui/react-native';
import { Thread } from '@/components/assistant-ui/elements/thread.aui';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AGENT_URL, getStore, setAuthCookie, toThreadMessages, type SpikeState } from './src/eve-transport';

// Spike screen: sign-in gate, then the assistant-ui native Thread wired to
// the eve session protocol through the external-store runtime bridge.
export default function App() {
  const store = getStore();
  const state = useSyncExternalStore<SpikeState>(
    (cb) => store.subscribe(cb),
    () => store.snapshot.data,
  );

  // EXPO_PUBLIC_SKIP_SIGN_IN=1 bypasses the gate for local dev testing.
  const [signedIn, setSignedIn] = useState(
    process.env.EXPO_PUBLIC_SKIP_SIGN_IN === '1',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signInState, setSignInState] = useState<
    'idle' | 'signing-in' | 'error'
  >('idle');
  const [signInError, setSignInError] = useState<string | null>(null);

  const signIn = useCallback(async () => {
    setSignInState('signing-in');
    setSignInError(null);
    try {
      // First-request agent compile can take 1-2 minutes on a cold dev
      // server; time out loudly instead of spinning forever.
      const timeout = AbortSignal.timeout(45_000);
      const res = await fetch(`${AGENT_URL}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: timeout,
      });
      const setCookie = res.headers.get('set-cookie') ?? '';
      const match = setCookie.match(/better-auth\.session_token=[^;]+/);
      if (!res.ok || !match) {
        const body = await res.text().catch(() => '');
        throw new Error(
          `Sign-in failed (${res.status}) ${body.slice(0, 160)}`,
        );
      }
      setAuthCookie(match[0]);
      setSignedIn(true);
    } catch (e) {
      setSignInState('error');
      const message =
        e instanceof Error ? e.message : String(e);
      setSignInError(
        message.includes('abort')
          ? `Can't reach ${AGENT_URL} — is the dev server up? (first request compiles the agent, ~1-2 min)`
          : message,
      );
    }
  }, [email, password]);

  // Local dev servers run eve's localDev() authenticator, which accepts
  // requests anonymously — no sign-in needed against localhost.
  const skipSignIn = useCallback(() => {
    setAuthCookie('');
    setSignedIn(true);
  }, []);

  const signOut = useCallback(() => {
    setAuthCookie(null);
    setSignedIn(false);
  }, []);

  const runtime = useExternalStoreRuntime({
    get messages(): ThreadMessageLike[] {
      return toThreadMessages(state);
    },
    convertMessage: (message) =>
      fromThreadMessageLike(
        message,
        message.id ?? 'spike-fallback',
        message.role === 'assistant'
          ? { type: 'running' }
          : { type: 'complete', reason: 'stop' },
      ),
    isRunning: state.status === 'streaming',
    isDisabled: false,
    onNew: async (message) => {
      const text = message.content
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('\n');
      await store.send({ message: text });
    },
    onCancel: async () => {
      await store.cancel();
    },
  });

  // Suggestions render as chips on the empty (new-chat) state, mirroring the
  // with-expo sample's root config.
  const config = useMemo(
    () =>
      AuiConfig({
        suggestions: Suggestions([
          {
            title: "What's on my plate",
            label: "right now?",
            prompt: "What's on my plate right now?",
          },
          {
            title: "Summarize my notes",
            label: "from this week",
            prompt: "Summarize what's in my notes from this week.",
          },
          {
            title: "Draft a reply",
            label: "I'm stuck on",
            prompt: "Help me write a reply I've been putting off.",
          },
        ]),
      }),
    [],
  );

  if (!signedIn) {
    return (
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <SafeAreaView style={styles.flexOne}>
          <View style={styles.center}>
            <Text style={styles.title}>eve — native iOS</Text>
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
            <Pressable style={styles.button} onPress={signIn}>
              <Text style={styles.buttonText}>
                {signInState === 'signing-in' ? 'Signing in…' : 'Sign in'}
              </Text>
            </Pressable>
            {signInError ? <Text style={styles.error}>{signInError}</Text> : null}
            <Pressable onPress={skipSignIn}>
              <Text style={styles.skip}>
                Continue without sign-in (local dev)
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <SafeAreaView style={styles.flexOne} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>my-agent</Text>
            <Text style={styles.headerUrl} numberOfLines={1}>
              {state.status === 'streaming' ? 'streaming…' : AGENT_URL}
            </Text>
          </View>
          <Pressable onPress={signOut}>
            <Text style={styles.skip}>Sign out</Text>
          </Pressable>
        </View>
      <View style={styles.flexOne}>
        <AssistantRuntimeProvider runtime={runtime} config={config}>
          <Thread />
        </AssistantRuntimeProvider>
      </View>
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flexOne: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  title: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  hint: { fontSize: 11, color: '#777', textAlign: 'center', marginBottom: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e4e4e7',
  },
  headerText: { flex: 1, marginRight: 12 },
  headerTitle: { fontSize: 15, fontWeight: '600' },
  headerUrl: { fontSize: 10, color: '#777' },
  input: {
    borderWidth: 1,
    borderColor: '#d4d4d8',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  button: {
    backgroundColor: '#18181b',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonText: { color: '#fff' },
  error: { color: '#b91c1c', textAlign: 'center' },
  skip: { color: '#777', textAlign: 'center', textDecorationLine: 'underline' },
});
