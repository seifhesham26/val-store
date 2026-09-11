import { createAuthClient } from "better-auth/react";
import { sentinelClient } from "@better-auth/infra/client";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
  plugins: [sentinelClient()],
});

// Export convenient hooks and methods
export const { signIn, signUp, signOut, useSession, $Infer } = authClient;
