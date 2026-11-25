import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as Network from "expo-network";

type NetworkStatusValue = {
  readonly offline: boolean;
  /** Mark offline after a transport failure (no HTTP response). */
  readonly reportNetworkFailure: () => void;
  /** Clear offline after a successful response. */
  readonly reportNetworkSuccess: () => void;
};

const NetworkStatusContext = createContext<NetworkStatusValue | null>(null);

/**
 * One offline signal for the signed-in tree.
 * expo-network drives the radio state; failed fetches can also set it.
 */
export function NetworkStatusProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Network.getNetworkStateAsync()
      .then((state) => {
        if (cancelled) return;
        const connected =
          state.isConnected !== false && state.isInternetReachable !== false;
        setOffline(!connected);
      })
      .catch(() => {
        // Keep the last known value when the probe fails.
      });

    const subscription = Network.addNetworkStateListener((state) => {
      const connected =
        state.isConnected !== false && state.isInternetReachable !== false;
      setOffline(!connected);
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  const reportNetworkFailure = useCallback(() => {
    setOffline(true);
  }, []);

  const reportNetworkSuccess = useCallback(() => {
    setOffline(false);
  }, []);

  const value = useMemo(
    () => ({ offline, reportNetworkFailure, reportNetworkSuccess }),
    [offline, reportNetworkFailure, reportNetworkSuccess],
  );

  return (
    <NetworkStatusContext.Provider value={value}>
      {children}
    </NetworkStatusContext.Provider>
  );
}

export function useNetworkStatus(): NetworkStatusValue {
  const context = useContext(NetworkStatusContext);
  if (!context) {
    return {
      offline: false,
      reportNetworkFailure: () => {},
      reportNetworkSuccess: () => {},
    };
  }
  return context;
}
