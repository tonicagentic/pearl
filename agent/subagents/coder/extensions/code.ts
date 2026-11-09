import code from "eve/extensions/code";

// Mount eve-code without an app Vercel connector. User-scoped deploy tokens
// are applied per command via authenticateVercel in deploy_vercel.
export default code({});
