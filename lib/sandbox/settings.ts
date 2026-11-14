export const BROWSER_TIMEOUT_MINUTES = [15, 30, 45, 90] as const;
export const CODER_TIMEOUT_MINUTES = [30, 45, 90] as const;
export const SANDBOX_VCPU_OPTIONS = [2, 4, 8] as const;

export type SandboxSettings = {
  readonly browserTimeoutMinutes: number;
  readonly browserVcpus: number;
  readonly coderTimeoutMinutes: number;
  readonly coderVcpus: number;
};

export const DEFAULT_SANDBOX_SETTINGS: SandboxSettings = {
  browserTimeoutMinutes: 30,
  browserVcpus: 2,
  coderTimeoutMinutes: 45,
  coderVcpus: 4,
};

export type SandboxSettingsPatch = {
  browserTimeoutMinutes?: number;
  browserVcpus?: number;
  coderTimeoutMinutes?: number;
  coderVcpus?: number;
};

export class SandboxSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SandboxSettingsError";
  }
}

export function browserTimeoutMs(settings: SandboxSettings): number {
  return settings.browserTimeoutMinutes * 60_000;
}

export function coderTimeoutMs(settings: SandboxSettings): number {
  return settings.coderTimeoutMinutes * 60_000;
}

/** Keep stored values that are still allowed; replace anything else with defaults. */
export function coerceSandboxSettings(
  input: Partial<SandboxSettings>,
): SandboxSettings {
  return {
    browserTimeoutMinutes: pick(
      input.browserTimeoutMinutes,
      BROWSER_TIMEOUT_MINUTES,
      DEFAULT_SANDBOX_SETTINGS.browserTimeoutMinutes,
    ),
    browserVcpus: pick(
      input.browserVcpus,
      SANDBOX_VCPU_OPTIONS,
      DEFAULT_SANDBOX_SETTINGS.browserVcpus,
    ),
    coderTimeoutMinutes: pick(
      input.coderTimeoutMinutes,
      CODER_TIMEOUT_MINUTES,
      DEFAULT_SANDBOX_SETTINGS.coderTimeoutMinutes,
    ),
    coderVcpus: pick(
      input.coderVcpus,
      SANDBOX_VCPU_OPTIONS,
      DEFAULT_SANDBOX_SETTINGS.coderVcpus,
    ),
  };
}

export function normalizeSandboxSettings(
  input: Partial<SandboxSettings>,
): SandboxSettings {
  return {
    browserTimeoutMinutes: oneOf(
      input.browserTimeoutMinutes,
      BROWSER_TIMEOUT_MINUTES,
      DEFAULT_SANDBOX_SETTINGS.browserTimeoutMinutes,
      "Browser lifetime",
    ),
    browserVcpus: oneOf(
      input.browserVcpus,
      SANDBOX_VCPU_OPTIONS,
      DEFAULT_SANDBOX_SETTINGS.browserVcpus,
      "Browser compute",
    ),
    coderTimeoutMinutes: oneOf(
      input.coderTimeoutMinutes,
      CODER_TIMEOUT_MINUTES,
      DEFAULT_SANDBOX_SETTINGS.coderTimeoutMinutes,
      "Coder lifetime",
    ),
    coderVcpus: oneOf(
      input.coderVcpus,
      SANDBOX_VCPU_OPTIONS,
      DEFAULT_SANDBOX_SETTINGS.coderVcpus,
      "Coder compute",
    ),
  };
}

function pick(
  value: number | undefined,
  allowed: readonly number[],
  fallback: number,
): number {
  if (value === undefined || !allowed.includes(value)) return fallback;
  return value;
}

function oneOf(
  value: number | undefined,
  allowed: readonly number[],
  fallback: number,
  label: string,
): number {
  if (value === undefined) return fallback;
  if (!allowed.includes(value)) {
    throw new SandboxSettingsError(`${label} must be ${allowed.join(", ")}.`);
  }
  return value;
}
