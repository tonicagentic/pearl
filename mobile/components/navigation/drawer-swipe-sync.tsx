import { useLayoutEffect } from "react";
import { useIsFocused } from "expo-router";

import { usePearlDrawer } from "@/components/navigation/drawer-context";

/**
 * Call from ScreenChrome. While focused with a back leading control,
 * disables drawer swipe so the native interactive pop owns the edge pan.
 */
export function useLockDrawerSwipeOnStackBack(hasBackButton: boolean) {
  const { setSwipeEnabled } = usePearlDrawer();
  const focused = useIsFocused();

  useLayoutEffect(() => {
    if (!focused) return;
    setSwipeEnabled(!hasBackButton);
  }, [focused, hasBackButton, setSwipeEnabled]);
}
