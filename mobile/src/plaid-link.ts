import { Alert } from "react-native";

type OpenPlaidLinkInput = {
  linkToken: string;
  onSuccess: (publicToken: string, institutionName: string | null) => void;
  onExit?: () => void;
};

/**
 * Open native Plaid Link when the SDK is linked into this binary.
 * Preview / production builds after adding react-native-plaid-link-sdk need a
 * new EAS build; until then, use sandbox one-click on Connections.
 */
export async function openPlaidLink(input: OpenPlaidLinkInput): Promise<boolean> {
  try {
    // Native module — missing in Expo Go / older binaries.
    const plaid = require("react-native-plaid-link-sdk") as {
      create: (config: {
        token: string;
        onSuccess: (result: {
          publicToken: string;
          metadata?: { institution?: { name?: string } | null };
        }) => void;
        onExit: () => void;
      }) => void;
      open: () => void;
    };

    plaid.create({
      token: input.linkToken,
      onSuccess: (result) => {
        input.onSuccess(
          result.publicToken,
          result.metadata?.institution?.name ?? null,
        );
      },
      onExit: () => input.onExit?.(),
    });
    plaid.open();
    return true;
  } catch {
    Alert.alert(
      "Plaid Link",
      "Bank linking needs a Pearl build that includes Plaid. Use Add sandbox bank when PLAID_ENV=sandbox, or install a new preview build.",
    );
    return false;
  }
}
