import {
  fullNameOf,
  parseOwnerName,
  type WorkbenchPinInput,
} from "./types.ts";

export type PinValidation =
  | { readonly ok: true; readonly pin: Required<Pick<WorkbenchPinInput, "owner" | "name">> & WorkbenchPinInput }
  | { readonly ok: false; readonly error: string };

export function validatePinInput(input: {
  readonly owner?: string;
  readonly name?: string;
  readonly fullName?: string;
  readonly vercelProjectId?: string | null;
  readonly vercelTeamId?: string | null;
  readonly expoProjectId?: string | null;
  readonly expoUpdateChannel?: string | null;
}): PinValidation {
  let owner = input.owner?.trim() ?? "";
  let name = input.name?.trim() ?? "";
  if ((!owner || !name) && input.fullName) {
    const parsed = parseOwnerName(input.fullName);
    if (!parsed) {
      return { ok: false, error: "fullName must look like owner/name." };
    }
    owner = parsed.owner;
    name = parsed.name;
  }
  if (!owner || !name) {
    return { ok: false, error: "owner and name are required." };
  }
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(name)) {
    return { ok: false, error: "owner/name contain invalid characters." };
  }

  return {
    ok: true,
    pin: {
      owner,
      name,
      vercelProjectId: emptyToNull(input.vercelProjectId),
      vercelTeamId: emptyToNull(input.vercelTeamId),
      expoProjectId: emptyToNull(input.expoProjectId),
      expoUpdateChannel: emptyToNull(input.expoUpdateChannel),
    },
  };
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function pinFullName(pin: { readonly owner: string; readonly name: string }): string {
  return fullNameOf(pin.owner, pin.name);
}
