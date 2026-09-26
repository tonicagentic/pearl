import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSyncExternalStore } from 'react';

import {
  PROD_URL,
  getStore,
  setAuthCookie,
  type SpikeState,
} from './src/eve-transport';

// Spike UI: plain RN components on purpose. This run proves the transport
// (auth -> session create -> streamed turn on device); assistant-ui native
// elements replace this screen only after the spike passes.

export default function App() {
  const store = getStore();
  const state = useSyncExternalStore<SpikeState>(
    (cb) => store.subscribe(cb),
    () => store.snapshot.data,
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signInState, setSignInState] = useState<
    'idle' | 'signing-in' | 'signed-in' | 'error'
  >('idle');
  const [signInError, setSignInError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const signIn = useCallback(async () => {
    setSignInState('signing-in');
    setSignInError(null);
    try {
      const res = await fetch(`${PROD_URL}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const setCookie = res.headers.get('set-cookie') ?? '';
      const match = setCookie.match(/better-auth\.session_token=[^;]+/);
      if (!res.ok || !match) {
        throw new Error(`Sign-in failed (${res.status})`);
      }
      setAuthCookie(match[0]);
      setSignInState('signed-in');
    } catch (e) {
      setSignInState('error');
      setSignInError(e instanceof Error ? e.message : String(e));
    }
  }, [email, password]);

  const send = useCallback(async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      await store.send({ message: draft.trim() });
      setDraft('');
    } finally {
      setSending(false);
    }
  }, [draft, sending, store]);

  if (signInState !== 'signed-in') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>eve — RN transport spike</Text>
        <Text style={styles.hint}>{PROD_URL}</Text>
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
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.header}>
        signed in · {state.status}
        {state.error ? ` · ${state.error}` : ''}
      </Text>
      <ScrollView style={styles.log}>
        {state.messages.map((m) => (
          <View key={m.id} style={styles.bubble}>
            <Text style={styles.role}>{m.role}</Text>
            <Text>{m.content}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Message"
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={send}
        />
        <Pressable style={styles.button} onPress={send}>
          <Text style={styles.buttonText}>{sending ? '…' : 'Send'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  container: { flex: 1, paddingTop: 60 },
  title: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  hint: { fontSize: 11, color: '#777', textAlign: 'center', marginBottom: 12 },
  header: {
    fontSize: 11,
    color: '#777',
    textAlign: 'center',
    padding: 8,
  },
  log: { flex: 1, paddingHorizontal: 12 },
  bubble: {
    backgroundColor: '#f1f1f4',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  role: { fontSize: 10, color: '#888', marginBottom: 2 },
  composer: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    paddingBottom: 36,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d4d4d8',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  button: {
    backgroundColor: '#18181b',
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  buttonText: { color: '#fff' },
  error: { color: '#b91c1c', textAlign: 'center' },
});
