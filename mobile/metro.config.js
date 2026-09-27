const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { withAui } = require("@assistant-ui/metro");
const { withUniwindConfig } = require("uniwind/metro");

const config = withUniwindConfig(
  withAui(getDefaultConfig(__dirname)),
  {
    cssEntryFile: "./global.css",
    dtsFile: "./uniwind-types.d.ts",
  },
);

// uniwind styles React Native components by redirecting every
// `import ... from "react-native"` to its own className-aware wrappers. Its
// resolver skips files that come from "the react-native package" by matching
// the substring `/react-native/` in the importing module's path — which also
// matches any package whose NAME contains react-native, such as
// @assistant-ui/react-native. For those packages the redirect never happens:
// the elements' classNames reach plain RN components, which drop them, so the
// thread renders unstyled (no flex layout, default black text).
//
// Force the redirect for third-party packages. uniwind's own files and the
// real react-native package keep the untouched resolution, matching what
// uniwind's heuristic was meant to do. Web already works: react-native-web
// consumes className natively, so the override is native-only.
const nodeModules = `${path.sep}node_modules${path.sep}`;
const isRealReactNativeOrigin = (originPath) =>
  originPath.includes(`${nodeModules}react-native${path.sep}`) ||
  originPath.includes(`${nodeModules}@react-native${path.sep}`);
// uniwind's own wrappers import react-native to re-export the real
// components; redirecting them would recurse forever.
const isUniwindOrigin = (originPath) =>
  originPath.includes(`${nodeModules}uniwind${path.sep}`);

const previousResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform !== "web" &&
    moduleName === "react-native" &&
    context.originModulePath &&
    context.originModulePath.includes(nodeModules) &&
    !isRealReactNativeOrigin(context.originModulePath) &&
    !isUniwindOrigin(context.originModulePath)
  ) {
    return context.resolveRequest(context, "uniwind/components", platform);
  }
  if (previousResolveRequest) {
    return previousResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
