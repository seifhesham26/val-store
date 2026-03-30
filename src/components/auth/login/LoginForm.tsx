"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { vanillaTrpc } from "@/lib/trpc";
import { PhoneValueObject } from "@/domain/customers/value-objects/phone.value-object";

export function LoginForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState(""); // Email or phone
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Helper to detect if input looks like a phone number (mostly digits)
  const isPhoneNumber = (value: string): boolean => {
    const digitsOnly = value.replace(/[^0-9]/g, "");
    // If more than 70% of characters are digits and has at least 7 digits
    return (
      digitsOnly.length >= 7 &&
      digitsOnly.length / value.length > 0.7 &&
      !value.includes("@")
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      let email = identifier;

      // If it looks like a phone number, look up the email
      if (isPhoneNumber(identifier)) {
        // Format phone to E.164 and look up email
        const formattedPhone = PhoneValueObject.toE164(identifier);
        if (!formattedPhone) {
          setError("Invalid phone number");
          setIsLoading(false);
          return;
        }

        // Call tRPC to get email by phone
        const result = await vanillaTrpc.auth.getEmailByPhone.query({
          phone: identifier,
        });

        if (!result.email) {
          setError("No account found with this phone number");
          setIsLoading(false);
          return;
        }

        email = result.email;
      }

      const { error: signInError } = await signIn.email({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message || "Invalid email or password");
        return;
      }

      // Success - redirect to home
      router.push("/");
      router.refresh();
    } catch {
      setError("An unexpected error occurred");
    } finally {
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
          className="bg-white/[0.06] border-white/10 text-white placeholder:text-gray-500"
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
          href="/signup"
          className="text-val-accent hover:text-val-accent-light transition-colors"
        >
          Sign up
        </Link>
      </div>
    </form>
  );
}
