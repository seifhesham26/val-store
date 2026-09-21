"use client";

import { useEffect, useRef, useState } from "react";

const READ_GATE_MS = 10_000;

function remainingReadMs(openedAt: Date | string | null | undefined): number {
  if (!openedAt) return READ_GATE_MS;
  const time = new Date(openedAt).getTime();
  if (Number.isNaN(time)) return READ_GATE_MS;
  return Math.max(0, READ_GATE_MS - (Date.now() - time));
}

/** Mirrors the server gate for affordance only; the server remains authority. */
export function useReadBeforeConfirm(input: {
  proposalVersion: number;
  openedAt: Date | string | null | undefined;
}) {
  const [remainingMs, setRemainingMs] = useState(() =>
    remainingReadMs(input.openedAt)
  );
  const previousVersion = useRef(input.proposalVersion);
  const openedAt = useRef(input.openedAt);

  useEffect(() => {
    const proposalChanged = previousVersion.current !== input.proposalVersion;
    previousVersion.current = input.proposalVersion;
    if (proposalChanged) openedAt.current = new Date();
    const remaining = remainingReadMs(openedAt.current);
    setRemainingMs(remaining);
    if (remaining === 0) return;
    const timer = window.setTimeout(() => setRemainingMs(0), remaining);
    return () => window.clearTimeout(timer);
  }, [input.proposalVersion]);

  return {
    canConfirm: remainingMs === 0,
    remainingSeconds: Math.ceil(remainingMs / 1_000),
  };
}
