import { afterEach, describe, expect, it, vi } from "vitest";
import { runProvisioningSteps } from "./post-signup-provisioning";

afterEach(() => {
  vi.restoreAllMocks();
});

/** Silence the expected error logging and let tests assert on it. */
function captureErrors() {
  return vi.spyOn(console, "error").mockImplementation(() => {});
}

describe("runProvisioningSteps", () => {
  it("runs every step, in order", async () => {
    const order: string[] = [];

    await runProvisioningSteps([
      { label: "first", run: async () => void order.push("first") },
      { label: "second", run: async () => void order.push("second") },
      { label: "third", run: async () => void order.push("third") },
    ]);

    expect(order).toEqual(["first", "second", "third"]);
  });

  it("keeps going after a step throws", async () => {
    // The whole point. These run after signup has already committed, so a
    // throw cannot undo the account — it just escapes `/sign-up/email` and
    // tells the customer their (working) signup failed, while skipping every
    // step behind it.
    captureErrors();
    const order: string[] = [];

    await runProvisioningSteps([
      {
        label: "profile",
        run: async () => {
          throw new Error("database is on fire");
        },
      },
      { label: "customer", run: async () => void order.push("customer") },
      { label: "notify", run: async () => void order.push("notify") },
    ]);

    expect(order).toEqual(["customer", "notify"]);
  });

  it("never rejects, even when every step fails", async () => {
    captureErrors();

    await expect(
      runProvisioningSteps([
        {
          label: "a",
          run: async () => {
            throw new Error("boom");
          },
        },
        {
          label: "b",
          run: async () => {
            throw new Error("bang");
          },
        },
      ])
    ).resolves.toEqual(["a", "b"]);
  });

  it("reports which steps failed and which did not", async () => {
    captureErrors();

    const failed = await runProvisioningSteps([
      { label: "profile", run: async () => {} },
      {
        label: "customer",
        run: async () => {
          throw new Error("unique violation");
        },
      },
      { label: "notify", run: async () => {} },
    ]);

    expect(failed).toEqual(["customer"]);
  });

  it("names the failing step in the log", async () => {
    // A signup that half-succeeded is invisible in the UI by design, so the
    // server log is the only place it is recoverable from.
    const errors = captureErrors();
    const cause = new Error("relation does not exist");

    await runProvisioningSteps([
      {
        label: "profile",
        run: async () => {
          throw cause;
        },
      },
    ]);

    expect(errors).toHaveBeenCalledTimes(1);
    expect(errors.mock.calls[0]![0]).toContain("profile");
    expect(errors.mock.calls[0]![1]).toBe(cause);
  });

  it("survives a step that throws synchronously", async () => {
    // `run` is typed as async, but a synchronous throw before the first await
    // is not caught by an ordinary `.catch()` on the returned promise.
    captureErrors();
    const order: string[] = [];

    const failed = await runProvisioningSteps([
      {
        label: "sync-thrower",
        run: (() => {
          throw new Error("thrown before any await");
        }) as () => Promise<void>,
      },
      { label: "after", run: async () => void order.push("after") },
    ]);

    expect(failed).toEqual(["sync-thrower"]);
    expect(order).toEqual(["after"]);
  });

  it("survives a step that rejects with a non-Error", async () => {
    captureErrors();

    const failed = await runProvisioningSteps([
      {
        label: "weird",
        run: async () => {
          throw "just a string";
        },
      },
    ]);

    expect(failed).toEqual(["weird"]);
  });
});
