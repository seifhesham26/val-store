"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useReveal } from "@/hooks/use-reveal";

interface NewsletterSectionProps {
  title?: string;
  subtitle?: string;
}

export function NewsletterSection({
  title = "Join the VAL Family",
  subtitle = "Be the first to know about new drops and exclusive offers",
}: NewsletterSectionProps) {
  const [email, setEmail] = useState("");
  const subscribeMutation = trpc.public.newsletter.subscribe.useMutation();
  const revealRef = useReveal<HTMLDivElement>();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    try {
      await subscribeMutation.mutateAsync({ email });
      setEmail("");
    } catch (error) {
      // Logged rather than discarded. The previous catch bound `error` and
      // never used it, so a rate limit, a network failure and a rejected
      // address all looked identical from the server side.
      console.error("[Newsletter] Subscribe failed:", error);
      toast.error("Failed to subscribe. Please try again.");
    }
  };

  return (
    <section className="bg-val-steel text-white py-16 md:py-20">
      <div
        ref={revealRef}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center"
      >
        <h2
          className="val-reveal text-3xl md:text-4xl lg:text-5xl font-bold mb-4"
          data-reveal
        >
          {title}
        </h2>
        <p
          className="val-reveal text-lg text-gray-300 mb-8 max-w-xl mx-auto"
          data-reveal
        >
          {subtitle}
        </p>

        {subscribeMutation.isSuccess ? (
          <p className="text-val-accent-light text-lg">
            Thanks for subscribing! Check your inbox soon.
          </p>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="val-reveal flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto"
            data-reveal
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="flex-1 px-4 py-3 rounded-md bg-white/10 border border-white/20 text-white placeholder:text-gray-400 focus:outline-none focus:border-val-accent transition-colors"
              required
            />
            <Button
              type="submit"
              disabled={subscribeMutation.isPending}
              className="bg-white text-black hover:bg-val-silver px-6 py-3 font-medium"
            >
              {subscribeMutation.isPending ? "Subscribing..." : "Subscribe"}
            </Button>
            <p className="text-[11px] leading-relaxed text-gray-400/70 sm:col-span-2 text-center">
              By subscribing, you agree to receive marketing emails from
              Valkyrie. Unsubscribe any time.{" "}
              <a
                href="/privacy"
                className="underline underline-offset-2 hover:text-white"
              >
                Privacy Policy
              </a>
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
