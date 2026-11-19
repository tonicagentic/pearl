/** Safe result returned to the model — never includes the viewer URL or token. */
export type DesktopActionResult = {
  readonly ok: boolean;
  readonly ready: boolean;
  readonly note?: string;
};
