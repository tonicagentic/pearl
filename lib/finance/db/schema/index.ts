// Finance tables only. The `user` stub in ./auth-stub is deliberately not exported:
// it exists purely so finance.ts can type its user_id foreign keys.
export * from "./finance";
