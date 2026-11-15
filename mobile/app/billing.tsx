import { Redirect } from "expo-router";

/**
 * Legacy full-screen billing route. Checkout now lives on the chats empty
 * state so signed-in users can still reach Profile and other home tabs.
 */
export default function BillingRoute() {
  return <Redirect href="/" />;
}
