const { getDefaultConfig } = require("expo/metro-config");
const { withAui } = require("@assistant-ui/metro");
const { withUniwindConfig } = require("uniwind/metro");

module.exports = withUniwindConfig(
  withAui(getDefaultConfig(__dirname)),
  {
    cssEntryFile: "./global.css",
    dtsFile: "./uniwind-types.d.ts",
  },
);
