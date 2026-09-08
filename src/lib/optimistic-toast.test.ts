import { describe, it, expect, vi, beforeEach } from "vitest";
import { toast } from "sonner";
import { showRetryToast, RETRY_ACTION_LABEL } from "./optimistic-toast";

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

describe("showRetryToast", () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
  });

  it("shows the message with a Retry action that runs the callback", () => {
    const onRetry = vi.fn();
    showRetryToast("Couldn't save that.", onRetry);

    expect(toast.error).toHaveBeenCalledTimes(1);
    const [message, options] = vi.mocked(toast.error).mock.calls[0];
    expect(message).toBe("Couldn't save that.");

    const action = (
      options as { action: { label: string; onClick: () => void } }
    ).action;
    expect(action.label).toBe(RETRY_ACTION_LABEL);

    expect(onRetry).not.toHaveBeenCalled();
    action.onClick();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
