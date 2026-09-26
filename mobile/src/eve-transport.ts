// Spike transport: eve's framework-agnostic EveAgentStore driven from a
// React Native app. The web template's useEveAgentRuntime is web-only
// (imports @assistant-ui/react), so this file re-implements the thin
// mapping: EveAgentStore snapshot -> @assistant-ui/react-native external
// store adapter, with a text-only message projection.
import { EveAgentStore } from 'eve/client';

// Agent endpoint: defaults to the production alias. For local testing against
// `pnpm dev` in the repo, set EXPO_PUBLIC_AGENT_URL=http://localhost:3000 in
// mobile/.env and restart Metro (env is inlined at bundle time).
export const AGENT_URL =
  process.env.EXPO_PUBLIC_AGENT_URL ?? 'https://my-agent-pi-eight.vercel.app';

// Session cookie captured at sign-in (memory only for the spike; SecureStore
// in a real build).
let authCookie: string | null = null;

export function setAuthCookie(cookie: string) {
  authCookie = cookie;
}

export type SpikeMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export type SpikeState = {
  messages: SpikeMessage[];
  status: string;
  error: string | null;
};

function initialState(): SpikeState {
  return { messages: [], status: 'ready', error: null };
}

let nextId = 1;

// Text-only projection for the spike. Tool calls, approvals, reasoning and
// attachments are intentionally dropped — that is the parity work item.
function reduce(state: SpikeState, event: any): SpikeState {
  switch (event?.type) {
    case 'client.message.submitted':
      return {
        ...state,
        messages: [
          ...state.messages,
          { id: `u${nextId++}`, role: 'user', content: event.data.message },
        ],
      };
    case 'message.appended': {
      // Assistant text delta: extend the trailing assistant message, creating
      // it if this is the first chunk of the turn's answer.
      const messages = [...state.messages];
      const last = messages[messages.length - 1];
      if (last?.role === 'assistant') {
        messages[messages.length - 1] = {
          ...last,
          content: last.content + event.data.messageDelta,
        };
      } else {
        messages.push({
          id: `a${nextId++}`,
          role: 'assistant',
          content: event.data.messageDelta,
        });
      }
      return { ...state, messages };
    }
    case 'turn.failed':
    case 'session.failed':
      return {
        ...state,
        status: 'error',
        error: event.data?.error?.message ?? 'Turn failed',
      };
    default:
      // step.*, session.*, reasoning.*, tool events: ignored for the spike.
      return state;
  }
}

let store: EveAgentStore<SpikeState> | null = null;

export function getStore(): EveAgentStore<SpikeState> {
  if (!store) {
    store = new EveAgentStore<SpikeState>({
      host: AGENT_URL,
      headers: () => {
        if (!authCookie) throw new Error('Not signed in');
        return { cookie: authCookie };
      },
      reducer: { initial: initialState, reduce },
    });
  }
  return store;
}
