import { EvalsBrowser } from "./evals-browser";

/**
 * Dev-only browser for local eve eval artifacts under `.eve/evals`.
 * Visit /dev/evals while `next dev` / `eve dev` is running.
 */
export default function EvalsDevPage() {
  if (process.env.NODE_ENV === "production") {
    return <p className="p-6 text-sm">Not available in production.</p>;
  }
  return <EvalsBrowser />;
}
