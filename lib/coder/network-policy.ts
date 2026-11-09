import type { SandboxSession } from "eve/sandbox";
import type { GitHubLeaseRule } from "eve/extensions/git";

/**
 * Baseline egress for the coder sandbox: public package registries, GitHub
 * (unauthenticated until a lease), Expo, and Vercel. Credentials are layered
 * on by the GitHub lease broker or authenticateVercel for one command.
 */
export const CODER_BASELINE_NETWORK_POLICY = {
  allow: {
    "registry.npmjs.org": [],
    "registry.yarnpkg.com": [],
    "nodejs.org": [],
    "pypi.org": [],
    "files.pythonhosted.org": [],
    "github.com": [],
    "api.github.com": [],
    "codeload.github.com": [],
    "objects.githubusercontent.com": [],
    "raw.githubusercontent.com": [],
    "ghcr.io": [],
    "expo.dev": [],
    "api.expo.dev": [],
    "exp.host": [],
    "u.expo.dev": [],
    "vercel.com": [],
    "api.vercel.com": [],
    "*.vercel.app": [],
    "*.vercel.run": [],
  },
} as const;

type NetworkAllow = Record<
  string,
  readonly { readonly transform: readonly { readonly headers: Readonly<Record<string, string>> }[] }[]
>;

function rulesToAllow(
  rules: Readonly<Record<string, readonly GitHubLeaseRule[]>>,
): NetworkAllow {
  const allow: NetworkAllow = {
    ...(CODER_BASELINE_NETWORK_POLICY.allow as unknown as NetworkAllow),
  };
  for (const [host, hostRules] of Object.entries(rules)) {
    allow[host] = hostRules.map((rule) => ({
      transform: rule.transform,
    }));
  }
  return allow;
}

type PolicySandbox = SandboxSession & {
  setNetworkPolicy(
    policy:
      | "allow-all"
      | "deny-all"
      | { readonly allow: NetworkAllow },
  ): Promise<void>;
};

function hasMutableNetworkPolicy(
  sandbox: SandboxSession,
): sandbox is PolicySandbox {
  return (
    "setNetworkPolicy" in sandbox &&
    typeof (sandbox as PolicySandbox).setNetworkPolicy === "function"
  );
}

/**
 * Install GitHub credential transforms for one `gh` call, then restore the
 * baseline public HTTPS policy when the lease ends (`rules === null`).
 */
export async function brokerGitHubLease(
  sandbox: SandboxSession,
  rules: Readonly<Record<string, readonly GitHubLeaseRule[]>> | null,
): Promise<void> {
  if (!hasMutableNetworkPolicy(sandbox)) {
    throw new Error(
      "Coder GitHub lease requires a sandbox with setNetworkPolicy (Vercel Sandbox).",
    );
  }
  if (rules === null) {
    await sandbox.setNetworkPolicy(
      CODER_BASELINE_NETWORK_POLICY as unknown as {
        readonly allow: NetworkAllow;
      },
    );
    return;
  }
  await sandbox.setNetworkPolicy({ allow: rulesToAllow(rules) });
}

/**
 * Merge Vercel credential header maps into the live policy for one deploy
 * command, keeping the baseline hosts. Used with authenticateVercel({ broker }).
 */
export async function brokerVercelHeaders(
  sandbox: SandboxSession,
  rules: Record<string, Record<string, string>>,
): Promise<void> {
  if (!hasMutableNetworkPolicy(sandbox)) {
    throw new Error(
      "Coder Vercel credential delivery requires setNetworkPolicy (Vercel Sandbox).",
    );
  }
  const allow: NetworkAllow = {
    ...(CODER_BASELINE_NETWORK_POLICY.allow as unknown as NetworkAllow),
  };
  for (const [host, headers] of Object.entries(rules)) {
    allow[host] = [{ transform: [{ headers }] }];
  }
  await sandbox.setNetworkPolicy({ allow });
}
