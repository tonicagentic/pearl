import { isValidElement, type ReactNode } from "react";

/** Flatten a React text tree the way UITextView concatenates nested Text. */
export function plainTextFromReactNode(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(plainTextFromReactNode).join("");
  if (isValidElement(node)) {
    return plainTextFromReactNode(
      (node.props as { children?: ReactNode }).children,
    );
  }
  return "";
}
