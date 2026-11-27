import { defineEval } from "eve/evals";
import { gateAssertion } from "../assertions.ts";

function usedMailSurface(
  toolCalls: ReadonlyArray<{ readonly name: string }>,
): boolean {
  return toolCalls.some(
    (call) =>
      call.name === "search_gmail_threads" ||
      call.name === "mail" ||
      call.name === "list_mail_accounts" ||
      call.name === "updates",
  );
}

const mailSurfaceGate = gateAssertion(
  "mail-surface",
  (value) => (value === true ? 1 : 0),
);

export default defineEval({
  description:
    "“Any important emails today?” → mail lookup / mail agent / updates; " +
    "no invented threads or full-body dump unprompted.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    const session = await t.session();
    const turn = await session.send(
      "Any important emails today? Just a short triage — don't paste full bodies.",
    );

    turn.expectOk();
    t.check(usedMailSurface(turn.toolCalls), mailSurfaceGate.gate()).label(
      "used-mail-surface",
    );

    t.judge(
        "The reply starts a real mail triage (Gmail search, mail subagent, " +
          "or updates brief for mail) or honestly says Connect/auth is " +
          "missing. It does not invent unread threads, senders, or subjects " +
          "as already fetched. It does not dump full email bodies unprompted.",
        { on: turn.reply },
      )
      .label("inbox-triage-honest")
      .atLeast(0.8);
  },
});
