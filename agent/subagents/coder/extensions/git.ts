import git from "eve/extensions/git";

import { brokerGitHubLease } from "@/lib/coder/network-policy";
import { coderCoAuthor } from "@/lib/coder/principal";
import { isBetterAuthUserPrincipal } from "@/agent/lib/user-connection";

const connector = process.env.GITHUB_CONNECTOR?.trim();

// User token: reaches everything the signed-in caller can reach. authorize
// only checks the principal — repository allowlists do not apply to user
// tokens (eve docs). Tokens stay behind the sandbox firewall via the lease
// broker.
export default git(
  connector
    ? {
        github: {
          connector,
          broker: brokerGitHubLease,
          principalType: "user",
          authorize: ({ auth }) => isBetterAuthUserPrincipal(auth),
          attribution: (ctx) => coderCoAuthor(ctx.session.auth.current),
        },
      }
    : {},
);
