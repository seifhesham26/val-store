import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useReadBeforeConfirm } from "./use-read-before-confirm";

describe("useReadBeforeConfirm", () => {
  it("keeps confirmation disabled until the proposal has been visible for ten seconds", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T08:00:00.000Z"));
    const { result } = renderHook(() =>
      useReadBeforeConfirm({ proposalVersion: 1, openedAt: new Date() })
    );

    expect(result.current.canConfirm).toBe(false);
    act(() => vi.advanceTimersByTime(9_999));
    expect(result.current.canConfirm).toBe(false);
    act(() => vi.runOnlyPendingTimers());
    expect(result.current.canConfirm).toBe(true);
    vi.useRealTimers();
  });

  it("restarts the read gate when an immutable proposal version changes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T08:00:00.000Z"));
    const openedAt = new Date();
    const { result, rerender } = renderHook(
      ({ proposalVersion }) =>
        useReadBeforeConfirm({ proposalVersion, openedAt }),
      { initialProps: { proposalVersion: 1 } }
    );

    act(() => vi.advanceTimersByTime(10_000));
    expect(result.current.canConfirm).toBe(true);
    rerender({ proposalVersion: 2 });
    expect(result.current.canConfirm).toBe(false);
    vi.useRealTimers();
  });
});
