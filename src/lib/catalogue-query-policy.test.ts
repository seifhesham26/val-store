import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CATALOGUE_QUERY_OPTIONS } from "./catalogue-query-policy";

describe("catalogue query cache policy", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reuses catalogue data for 30 minutes and refreshes after it becomes stale", async () => {
    vi.useFakeTimers();

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    let requests = 0;
    const query = {
      queryKey: ["catalogue", "all"],
      queryFn: async () => ++requests,
      ...CATALOGUE_QUERY_OPTIONS,
    };

    expect(await client.fetchQuery(query)).toBe(1);

    await vi.advanceTimersByTimeAsync(30 * 60 * 1000 - 1);
    expect(await client.fetchQuery(query)).toBe(1);
    expect(requests).toBe(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(await client.fetchQuery(query)).toBe(2);
    expect(requests).toBe(2);

    client.clear();
  });
});
