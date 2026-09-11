"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { ValkyrieLoader } from "@/components/ui/valkyrie-loader";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  // Initialize state based on token presence to avoid setState in effect
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    token ? "loading" : "error"
  );
  const [message, setMessage] = useState(
    token ? "" : "No verification token provided"
  );

  useEffect(() => {
    if (!token) return; // Already handled in initial state

    const verifyEmail = async () => {
      try {
        // Call Better Auth verify endpoint directly
        const response = await fetch(`/api/auth/verify-email?token=${token}`, {
          method: "GET",
        });

        if (response.ok) {
          setStatus("success");
          setMessage("Your email has been verified successfully!");
          // Auto-login: redirect to home after 2 seconds
          setTimeout(() => router.push("/"), 2000);
        } else {
          const data = await response.json().catch(() => ({}));
          setStatus("error");
          setMessage(
            data.message || "Verification failed. The link may have expired."
          );
        }
      } catch {
        setStatus("error");
        setMessage("An unexpected error occurred");
      }
    };

    verifyEmail();
  }, [token, router]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md bg-zinc-900 border-white/10 text-white">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            {status === "loading" && (
              <>
                <ValkyrieLoader inline size="xs" className="h-6 w-6" />
                Verifying your email...
              </>
            )}
            {status === "success" && (
              <>
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                Email Verified!
              </>
            )}
            {status === "error" && (
              <>
                <XCircle className="h-6 w-6 text-red-500" />
                Verification Failed
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-400">{message}</p>

          {status === "success" && (
            <p className="text-sm text-gray-500">Redirecting to home...</p>
          )}

          {status === "error" && (
            <div className="space-y-2">
              <Button
                asChild
                className="w-full bg-white text-black hover:bg-gray-200"
              >
                <Link href="/signup">Try signing up again</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full border-white/10 text-white hover:bg-white/[0.06]"
              >
                <Link href="/login">Go to login</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <ValkyrieLoader size="md" label="Loading" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
