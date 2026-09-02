"use client";

/**
 * Last-resort error boundary.
 *
 * Catches a throw in the root layout itself, which `(main)/error.tsx` and
 * `admin/error.tsx` cannot — by the time this renders, the root layout has
 * failed, so this file must supply its own `<html>` and `<body>`.
 *
 * That also means it gets no fonts, no globals.css cascade and no providers.
 * Everything here is inline so it cannot itself depend on the thing that
 * broke.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          padding: "1rem",
          textAlign: "center",
          background: "#000",
          color: "#fff",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
          Something went wrong
        </h1>
        <p style={{ margin: 0, color: "#9ca3af", maxWidth: "28rem" }}>
          The page failed to load. Trying again often resolves it.
        </p>
        {error.digest && (
          <p style={{ margin: 0, fontSize: "0.75rem", color: "#4b5563" }}>
            Reference: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{
            marginTop: "0.5rem",
            border: 0,
            borderRadius: "0.375rem",
            background: "#94a3b8",
            color: "#000",
            padding: "0.625rem 1.25rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
