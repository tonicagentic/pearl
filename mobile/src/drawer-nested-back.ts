import type { NavigationState, PartialState } from "@react-navigation/native";

type NavState = NavigationState | PartialState<NavigationState>;

const SIBLING_NAVIGATOR_TYPES = new Set([
  "drawer",
  "tab",
  "bottom-tab",
  "material-top-tabs",
  "material-bottom-tabs",
]);

/**
 * True when the focused branch includes a push navigator with index > 0 —
 * i.e. a screen that shows back and owns the interactive pop gesture.
 * Sibling navigators (drawer / tabs) are skipped so switching destinations
 * does not count as "can go back".
 */
export function focusedNestedStackCanGoBack(
  state: NavState | undefined,
): boolean {
  let current: NavState | undefined = state;
  while (current && "routes" in current && Array.isArray(current.routes)) {
    const index = current.index ?? 0;
    const type = "type" in current ? current.type : undefined;
    const isSibling =
      typeof type === "string" && SIBLING_NAVIGATOR_TYPES.has(type);

    // Stacks (and unknown push navigators) with history own the edge swipe.
    // Expo Router state sometimes omits `type`, so treat non-sibling + index>0
    // as back-capable rather than requiring type === "stack".
    if (!isSibling && index > 0) {
      return true;
    }

    const route = current.routes[index];
    current = route && "state" in route ? route.state : undefined;
  }
  return false;
}
