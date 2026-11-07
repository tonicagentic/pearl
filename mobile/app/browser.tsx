import { Redirect, useLocalSearchParams } from "expo-router";

import { InAppBrowserScreen } from "@/components/in-app-browser-screen";
import { isInAppWebUrl } from "@/src/open-web-url";

export default function BrowserRoute() {
  const { url: raw } = useLocalSearchParams<{ url?: string | string[] }>();
  const url = Array.isArray(raw) ? raw[0] : raw;

  if (!url || !isInAppWebUrl(url)) {
    return <Redirect href="/" />;
  }

  return <InAppBrowserScreen url={url} />;
}
