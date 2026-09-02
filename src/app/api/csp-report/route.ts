/**
 * CSP violation collector.
 *
 * The report-only half of the policy in `next.config.ts` names this endpoint.
 * Without a collector, report-only is the one configuration that achieves
 * nothing: it blocks nothing and records nothing, so the "watch it for a few
 * days, then promote it" plan can never actually start.
 *
 * This is an unauthenticated endpoint that browsers POST to, so it is written
 * to be a bad target: the body is capped before it is read, the payload is
 * summarised to a handful of known fields rather than logged wholesale, and it
 * shares the general-purpose rate limiter. It always answers 204 — a browser
 * has nothing useful to do with an error, and saying more would only tell a
 * prober which of its requests got through.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  apiRateLimiter,
  checkRateLimit,
  getClientIp,
} from "@/server/utils/rate-limiter";

/**
 * Reports are small. Anything larger is not a browser doing its job, and the
 * length is checked before the body is read so an oversized one costs nothing.
 */
const MAX_BODY_BYTES = 16 * 1024;

/** Always 204: nothing is gained by telling a caller how it did. */
const ACK = new NextResponse(null, { status: 204 });

/**
 * The two shapes browsers send: the legacy `report-uri` envelope and the
 * `Reporting-API` array that `report-to` produces.
 */
interface ViolationFields {
  "document-uri"?: unknown;
  "violated-directive"?: unknown;
  "effective-directive"?: unknown;
  "blocked-uri"?: unknown;
}

function summarise(body: unknown): ViolationFields[] {
  if (Array.isArray(body)) {
    // Reporting API: [{ type, url, body: { documentURL, ... } }, …]
    return body
      .filter(
        (entry): entry is { body?: unknown } =>
          typeof entry === "object" && entry !== null
      )
      .map((entry) => (entry.body ?? {}) as ViolationFields);
  }

  if (typeof body === "object" && body !== null) {
    // Legacy: { "csp-report": { … } }
    const legacy = (body as { "csp-report"?: unknown })["csp-report"];
    if (typeof legacy === "object" && legacy !== null) {
      return [legacy as ViolationFields];
    }
  }

  return [];
}

/** Only the fields worth acting on, and only as strings. */
function pick(report: ViolationFields & Record<string, unknown>) {
  const asString = (value: unknown) =>
    typeof value === "string" ? value.slice(0, 512) : undefined;

  return {
    documentUri: asString(report["document-uri"] ?? report.documentURL),
    directive: asString(
      report["effective-directive"] ??
        report["violated-directive"] ??
        report.effectiveDirective
    ),
    blockedUri: asString(report["blocked-uri"] ?? report.blockedURL),
  };
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return ACK;
  }

  const { allowed } = await checkRateLimit(
    apiRateLimiter,
    `csp-report:${getClientIp(request.headers)}`
  );
  if (!allowed) {
    return ACK;
  }

  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return ACK;
    }

    for (const report of summarise(JSON.parse(raw))) {
      const { documentUri, directive, blockedUri } = pick(
        report as ViolationFields & Record<string, unknown>
      );

      // Nothing to act on without a directive, and a report with none is not
      // worth a log line.
      if (!directive) continue;

      console.warn(
        JSON.stringify({
          event: "csp-violation",
          directive,
          blockedUri,
          documentUri,
        })
      );
    }
  } catch {
    // Unparseable. There is no report to record and nothing to tell anyone.
  }

  return ACK;
}
