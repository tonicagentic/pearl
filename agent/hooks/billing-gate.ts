import { defineHook } from "eve/hooks";

import { getBillingAccess, isBillingActive } from "@/lib/billing/accounts";
import {
  blockMessage,
  DEFAULT_TURN_RESERVATION_CENTS,
} from "@/lib/billing/config";
import { assertCanSpend } from "@/lib/billing/ledger";

/**
 * Hard stop before expensive work. Free-pass and non-billing deployments
 * skip. Paying users need an active subscription and remaining cap room.
 *
 * turn.started: reserve a small amount so concurrent chats cannot both
 * clear a near-cap check. usage.recorded (billing-usage hook) records the
 * real cost; reservations expire if a turn dies without settling.
 */
export default defineHook({
  events: {
    async "turn.started"(_event, ctx) {
      try {
        if (!(await isBillingActive())) {
          return;
        }

        const principalId =
          ctx.session.auth.current?.principalId ??
          ctx.session.auth.initiator?.principalId ??
          null;
        if (!principalId) {
          return;
        }

        const result = await assertCanSpend({
          userId: principalId,
          cents: DEFAULT_TURN_RESERVATION_CENTS,
          reason: `turn:${ctx.turn?.id ?? ctx.session.id}`,
        });

        if (!result.ok) {
          ctx.cancel(blockMessage(result.reason));
        }
      } catch (error) {
        console.error("[billing-gate] turn.started", error);
        if (await isBillingActive()) {
          ctx.cancel("Billing check failed. Try again in a moment.");
        }
      }
    },

    async "model.requested"(_event, ctx) {
      try {
        if (!(await isBillingActive())) {
          return;
        }

        const principalId =
          ctx.session.auth.current?.principalId ??
          ctx.session.auth.initiator?.principalId ??
          null;
        if (!principalId) {
          return;
        }

        // Re-check without a second reservation: if the cap was hit mid-turn
        // (another chat burned the rest), stop before the next model call.
        const access = await getBillingAccess(principalId);
        if (
          access.enabled &&
          !access.exempt &&
          !access.allowed &&
          access.reason
        ) {
          ctx.cancel(blockMessage(access.reason));
        }
      } catch (error) {
        console.error("[billing-gate] model.requested", error);
      }
    },
  },
});
