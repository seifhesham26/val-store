"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, RefreshCw } from "lucide-react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { ValkyrieLoader } from "@/components/ui/valkyrie-loader";
import { toast } from "sonner";

function CheckEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const handleResendEmail = async () => {
    if (resendCooldown > 0 || !email) return;

    setIsResending(true);
    try {
      // Better Auth provides a method to resend verification email
      const { error } = await authClient.sendVerificationEmail({
        email: email,
        callbackURL: "/verify-email",
      });

      if (error) {
        toast.error(error.message || "Failed to resend verification email");
        return;
      }

      toast.success("Verification email sent! Please check your inbox.");

      // Start 60 second cooldown
      setResendCooldown(60);
      const interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch {
      toast.error("Failed to resend verification email");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md text-center bg-zinc-900 border-white/10 text-white">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-val-accent/10">
            <Mail className="h-8 w-8 text-val-accent" />
          </div>
          <CardTitle className="text-white">Check your email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-400">
            We&apos;ve sent a verification link to{" "}
            {email ? (
              <strong className="text-white">{email}</strong>
            ) : (
              "your email"
            )}
            . Please check your inbox and click the link to verify.
          </p>
          <p className="text-sm text-gray-500">
            Didn&apos;t receive the email? Check your spam folder or click below
            to resend.
          </p>

          {email && (
            <Button
              onClick={handleResendEmail}
              disabled={isResending || resendCooldown > 0}
              variant="secondary"
              className="w-full bg-white/6 border border-white/10 text-white hover:bg-white/10"
            >
              {isResending ? (
                <>
                  <ValkyrieLoader inline size="xs" className="mr-2 h-4 w-4" />
                  Sending...
                </>
              ) : resendCooldown > 0 ? (
                `Resend in ${resendCooldown}s`
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Resend verification email
                </>
              )}
            </Button>
          )}

          <Button
            asChild
            variant="outline"
            className="w-full bg-transparent border-white/10 text-white hover:bg-white/10 hover:text-white"
          >
            <Link href="/login">Back to login</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <ValkyrieLoader size="md" label="Loading" />
        </div>
      }
    >
      <CheckEmailContent />
    </Suspense>
  );
}
