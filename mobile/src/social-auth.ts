import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import * as AppleAuthentication from "expo-apple-authentication";
import { CryptoDigestAlgorithm, digestStringAsync } from "expo-crypto";

type GoogleSigninModule = typeof import("@react-native-google-signin/google-signin");

let googleModule: GoogleSigninModule | null | undefined;

/** Expo Go does not include RNGoogleSignin; the package throws while loading. */
function loadGoogleSignin(): GoogleSigninModule | null {
  if (googleModule !== undefined) return googleModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    googleModule =
      require("@react-native-google-signin/google-signin") as GoogleSigninModule;
  } catch {
    googleModule = null;
  }
  return googleModule;
}

export type SocialIdToken = {
  readonly provider: "google" | "apple";
  readonly token: string;
  readonly nonce?: string;
  readonly accessToken?: string;
  readonly email: string | null;
  readonly name: string | null;
};

const googleWebClientId =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? "";
const googleIosClientId =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ?? "";

let googleConfigured = false;

function ensureGoogleConfigured() {
  const google = loadGoogleSignin();
  if (!google) {
    throw new Error("Google sign-in isn’t available in Expo Go.");
  }
  if (googleConfigured) return;
  if (!googleWebClientId) {
    throw new Error(
      "Google sign-in isn’t configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.",
    );
  }
  google.GoogleSignin.configure({
    webClientId: googleWebClientId,
    iosClientId: googleIosClientId || undefined,
    offlineAccess: false,
  });
  googleConfigured = true;
}

export function isGoogleSignInAvailable() {
  return Boolean(googleWebClientId) && loadGoogleSignin() != null;
}

/**
 * True only when the Expo Apple Auth native module is linked in this binary.
 * `requireNativeView` still returns a Fabric stub when missing, so mounting
 * `AppleAuthenticationButton` crashes with UnimplementedView — gate on this.
 */
export function isAppleSignInNativeLinked() {
  if (Platform.OS !== "ios") return false;
  return requireOptionalNativeModule("ExpoAppleAuthentication") != null;
}

export async function isAppleSignInAvailable() {
  if (!isAppleSignInNativeLinked()) return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function requestGoogleIdToken(): Promise<SocialIdToken> {
  const google = loadGoogleSignin();
  if (!google) {
    throw new Error("Google sign-in isn’t available in Expo Go.");
  }
  ensureGoogleConfigured();
  await google.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await google.GoogleSignin.signIn();
  if (!google.isSuccessResponse(response) || !response.data.idToken) {
    throw new Error("Google sign-in was cancelled.");
  }
  const user = response.data.user;
  return {
    provider: "google",
    token: response.data.idToken,
    email: user.email ?? null,
    name: user.name ?? null,
  };
}

export function describeGoogleSignInError(cause: unknown): string {
  const google = loadGoogleSignin();
  if (google?.isErrorWithCode(cause)) {
    if (cause.code === google.statusCodes.SIGN_IN_CANCELLED) {
      return "Google sign-in was cancelled.";
    }
    if (cause.code === google.statusCodes.IN_PROGRESS) {
      return "Google sign-in is already in progress.";
    }
    if (cause.code === google.statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return "Google Play Services aren’t available on this device.";
    }
  }
  return cause instanceof Error ? cause.message : String(cause);
}

function randomNonce(length = 32): string {
  const alphabet =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]!;
  }
  return out;
}

export async function requestAppleIdToken(): Promise<SocialIdToken> {
  if (Platform.OS !== "ios") {
    throw new Error("Apple sign-in is only available on iOS.");
  }
  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) {
    throw new Error("Apple sign-in isn’t available on this device.");
  }

  // Apple embeds SHA-256(nonce) in the ID token; better-auth accepts the raw nonce.
  const rawNonce = randomNonce();
  const hashedNonce = await digestStringAsync(
    CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!credential.identityToken) {
    throw new Error("Apple did not return an identity token.");
  }

  const nameParts = [
    credential.fullName?.givenName,
    credential.fullName?.familyName,
  ].filter((part): part is string => Boolean(part?.trim()));

  return {
    provider: "apple",
    token: credential.identityToken,
    nonce: rawNonce,
    email: credential.email ?? null,
    name: nameParts.length > 0 ? nameParts.join(" ") : null,
  };
}

export function describeAppleSignInError(cause: unknown): string {
  if (
    cause &&
    typeof cause === "object" &&
    "code" in cause &&
    (cause as { code?: string }).code === "ERR_REQUEST_CANCELED"
  ) {
    return "Apple sign-in was cancelled.";
  }
  return cause instanceof Error ? cause.message : String(cause);
}
