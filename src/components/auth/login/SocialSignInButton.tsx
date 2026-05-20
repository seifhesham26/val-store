"use client";

import { useState } from "react";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SocialSignInButtonProps {
  provider: "google" | "facebook";
  icon: React.ReactNode;
  label: string;
}

export function SocialSignInButton({
  provider,
  icon,
  label,
}: SocialSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn.social({
        provider,
        callbackURL: "/",
      });
    } catch {
      toast.error(`Failed to sign in with ${label}`);
      setIsLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full border-white/10 bg-white/6 text-white hover:bg-white/10"
      onClick={handleSignIn}
      disabled={isLoading}
    >
      {isLoading ? (
        "Connecting..."
      ) : (
        <span className="inline-flex items-center gap-2">
          {icon}
          {label}
        </span>
      )}
    </Button>
  );
}
