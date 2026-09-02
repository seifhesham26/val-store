"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { vanillaTrpc } from "@/lib/trpc";
import { safeRedirect } from "@/lib/safe-url";

export function LoginForm() {
  const searchParams = useSearchParams();
  // `?redirect=` is attacker-controllable — see `safe-url.ts`. Same-origin
  // paths only; anything else lands on the home page.
  const redirectUrl = safeRedirect(searchParams.get("redirect"));
  const [identifier, setIdentifier] = useState(""); // Email or phone
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  /**
   * One request, and the server does the deciding.
   *
   * This used to be three: classify the identifier here, ask the server to
   * turn a phone number into the account's email address, then sign in with
   * that email. The middle step handed out email addresses to anyone who asked
   * (see `src/server/routers/auth.ts`), so classification, lookup and sign-in
   * all moved behind one mutation. The browser now sends what the person
   * typed and learns only whether it worked.
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await vanillaTrpc.auth.signIn.mutate({ identifier, password });

      // A full navigation rather than `router.push`, because the session was
      // established by a `Set-Cookie` on a tRPC response rather than through
      // the Better Auth client. That leaves the client's session store — what
      // every `useSession` in the app reads — holding its signed-out value,
      // and a soft navigation would carry it across. Reloading re-reads
      // everything from the cookie that now exists.
      //
      // `redirectUrl` has already been through `safeRedirect`, so this is a
      // same-origin path.
      window.location.assign(redirectUrl);
    } catch (err) {
      // Every server-side failure carries the same message by design — see
      // GENERIC_FAILURE in the auth router.
      setError(
        err instanceof Error && err.message
          ? err.message
          : "An unexpected error occurred"
      );
      setIsLoading(false);
    }
  };

  // Handle input change - filter non-numbers if it looks like phone
  const handleIdentifierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only filter if it's clearly a phone number (starts with numbers or +)
    if (/^[+\d]/.test(value) && !value.includes("@")) {
      // Allow only numbers and +
      setIdentifier(value.replace(/[^0-9+]/g, ""));
    } else {
      setIdentifier(value);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="identifier" className="text-gray-300">
          Email or Phone
        </Label>
        <Input
          id="identifier"
          type="text"
          placeholder="john@example.com or 1234567890"
          value={identifier}
          onChange={handleIdentifierChange}
          required
          className="bg-white/6 border-white/10 text-white placeholder:text-gray-500"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password" className="text-gray-300">
            Password
          </Label>
          <Link
            href="/forgot-password"
            className="text-sm text-val-accent hover:text-val-accent-light transition-colors"
          >
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <Button
        type="submit"
        className="w-full bg-val-accent text-white hover:bg-val-accent-light hover:text-black transition-colors"
        disabled={isLoading}
      >
        {isLoading ? "Signing in..." : "Sign in"}
      </Button>

      <div className="mt-4 text-center text-sm text-gray-400">
        Don&apos;t have an account?{" "}
        <Link
          href={`/signup${searchParams.toString() ? `?${searchParams.toString()}` : ""}`}
          className="text-val-accent hover:text-val-accent-light transition-colors"
        >
          Sign up
        </Link>
      </div>
    </form>
  );
}
