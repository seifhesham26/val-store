export type DevelopmentResetMode = "dry-run" | "apply";

export function getDevelopmentResetMode(
  args: readonly string[]
): DevelopmentResetMode {
  return args.includes("--apply") ? "apply" : "dry-run";
}

export function assertDevelopmentResetAllowed(
  nodeEnv: string | undefined
): void {
  if (nodeEnv === "production") {
    throw new Error(
      "Development inventory reset is disabled when NODE_ENV=production"
    );
  }
}
