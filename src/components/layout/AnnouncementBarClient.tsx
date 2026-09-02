"use client";

/**
 * Announcement Bar Client Component
 *
 * Handles dismiss functionality and message rotation.
 */

import { useState, useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { safeHref } from "@/lib/safe-url";

const DISMISS_KEY = "announcement_dismissed";
const DISMISS_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

// Helper to check if dismissed from localStorage
function getIsDismissed(): boolean {
  if (typeof window === "undefined") return false;
  const dismissed = localStorage.getItem(DISMISS_KEY);
  if (dismissed) {
    const dismissedAt = parseInt(dismissed, 10);
    if (Date.now() - dismissedAt < DISMISS_EXPIRY) {
      return true;
    }
  }
  return false;
}

// Subscribe function for useSyncExternalStore (no-op since we don't need live updates)
function subscribe() {
  // No external subscription needed
  return () => {};
}

interface AnnouncementBarClientProps {
  messages: Array<{ text: string; link?: string } | string>;
  rotateInterval: number;
  backgroundColor: string;
  textColor: string;
  dismissible: boolean;
  linkUrl?: string;
  linkText?: string;
}

export function AnnouncementBarClient({
  messages,
  rotateInterval,
  backgroundColor,
  textColor,
  dismissible,
  linkUrl,
  linkText,
}: AnnouncementBarClientProps) {
  // Use useSyncExternalStore for hydration-safe localStorage check
  const isDismissedFromStorage = useSyncExternalStore(
    subscribe,
    getIsDismissed,
    () => false // Server snapshot
  );

  const [isDismissed, setIsDismissed] = useState(isDismissedFromStorage);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Rotate messages
  useEffect(() => {
    if (messages.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % messages.length);
    }, rotateInterval);

    return () => clearInterval(interval);
  }, [messages.length, rotateInterval]);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setIsDismissed(true);
  };

  if (isDismissed) {
    return null;
  }

  const currentMessage = messages[currentIndex];
  const messageText =
    typeof currentMessage === "string" ? currentMessage : currentMessage?.text;

  // The bar renders on every storefront page, and `linkUrl` originates in
  // admin-editable CMS content that reaches this component as a plain string —
  // the server component reads it with `JSON.parse` and does not re-validate.
  // An unsafe value yields no link at all rather than a default: an
  // announcement without a link is simply an announcement.
  const safeLinkUrl = safeHref(linkUrl);

  return (
    <div
      className="relative py-2 px-4 text-center text-sm"
      style={{ backgroundColor, color: textColor }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
        <span>{messageText}</span>

        {safeLinkUrl && linkText && (
          <Link
            href={safeLinkUrl}
            className="font-semibold underline underline-offset-2 hover:no-underline"
          >
            {linkText}
          </Link>
        )}

        {/* Message dots indicator */}
        {messages.length > 1 && (
          <div className="flex gap-1 ml-3">
            {messages.map((_, i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full transition-opacity"
                style={{
                  backgroundColor: textColor,
                  opacity: i === currentIndex ? 1 : 0.4,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dismiss button */}
      {dismissible && (
        <button
          onClick={handleDismiss}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:opacity-70 transition-opacity"
          aria-label="Dismiss announcement"
        >
          <X className="h-4 w-4" style={{ color: textColor }} />
        </button>
      )}
    </div>
  );
}
