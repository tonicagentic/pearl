export type MailBatchAction =
  | { readonly type: "archive" }
  | { readonly type: "mark_read" }
  | { readonly type: "add_label"; readonly labelId: string }
  | { readonly type: "remove_label"; readonly labelId: string };

export type MailBatchItem = {
  readonly accountId: string;
  readonly threadId: string;
  readonly action: MailBatchAction;
  readonly subject?: string | null;
  readonly from?: string | null;
};

export type MailBatchResult = {
  readonly threadId: string;
  readonly accountId: string;
  readonly ok: boolean;
  readonly error?: string;
};
