"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";

const STORAGE_KEY = "cookie-notice-dismissed";

function subscribe() {
  return () => {};
}

function getSnapshot() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function getServerSnapshot() {
  return false;
}

/**
 * Transparency notice, not a consent gate. The store sets only one cookie —
 * the Better Auth session, which also carries the guest cart — and runs no
 * analytics, advertising or third-party marketing scripts (see the "Cookies"
 * section of /privacy). Strictly-necessary cookies don't require an opt-in
 * banner under GDPR/ePrivacy, so this only needs to disclose and link out,
 * not block the page or offer accept/reject choices.
 *
 * `useSyncExternalStore` reads localStorage rather than a `useEffect` +
 * `setState`, matching the hydration-safety pattern used for the cart/nav
 * badges: SSR always renders "not previously dismissed" (server snapshot is
 * `false`), and the client corrects itself on the first render pass instead
 * of flashing the banner in after mount.
 */
export function CookieNotice() {
  const alreadyDismissed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
  const [justDismissed, setJustDismissed] = useState(false);

  if (alreadyDismissed || justDismissed) return null;

  const dismiss = () => {
    setJustDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Storage unavailable (private mode, disabled): the in-memory dismiss
      // above still hides it for the rest of this page view.
    }
  };

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-black/95 px-4 py-4 backdrop-blur-sm sm:px-6"
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 sm:flex-row sm:justify-between sm:gap-6">
        <p className="text-center text-xs leading-relaxed text-gray-400 sm:text-left">
          We use one essential cookie to keep you signed in and remember your
          cart. We don&apos;t run analytics or advertising trackers. See our{" "}
          <Link
            href="/privacy"
            className="text-val-accent underline underline-offset-2 hover:text-val-accent-light"
          >
            Privacy Policy
          </Link>{" "}
          for details.
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-md bg-val-accent px-4 py-2 text-xs font-medium text-black transition-colors hover:bg-val-accent-light"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
