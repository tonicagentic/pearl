import {
  eventsFromReplaySample,
  type SampleTimedStreamEvent,
} from "../../lib/sample-stream-replay";
import type { ThreadSample } from "./thread-samples";

export type { SampleTimedStreamEvent };

export function eventsFromThreadSample(
  sample: ThreadSample,
): SampleTimedStreamEvent[] {
  return eventsFromReplaySample({
    id: sample.id,
    messages: sample.messages,
  });
}
