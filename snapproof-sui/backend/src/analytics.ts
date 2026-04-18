/**
 * Thin analytics abstraction for the backend. No-ops when no provider is configured.
 *
 * Set SENTRY_DSN (and optionally SENTRY_ENV) to enable error reporting.
 * Any event tracking backend can be plugged in by implementing the `track` function.
 */

import { logger } from "./logger.js";

type EventName =
  | "proof_queried"
  | "proof_verified"
  | "proof_indexed"
  | "backend_started"
  | "rpc_failure";

export interface AnalyticsEvent {
  name: EventName;
  props?: Record<string, string | number | boolean | null | undefined>;
}

const SENTRY_DSN = process.env.SENTRY_DSN ?? "";

let sentryReady = false;

export async function initAnalytics() {
  if (!SENTRY_DSN) {
    logger.info("analytics: no SENTRY_DSN — running in no-op mode");
    return;
  }

  try {
    // Lazy-load so the dependency is optional in the lockfile at install time.
    const Sentry: typeof import("@sentry/node") | undefined =
      await import("@sentry/node" as string).catch(() => undefined);
    if (!Sentry) {
      logger.warn("analytics: SENTRY_DSN set but @sentry/node not installed — skipping");
      return;
    }
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: process.env.SENTRY_ENV ?? process.env.NODE_ENV ?? "development",
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    });
    sentryReady = true;
    logger.info("analytics: Sentry initialized");
  } catch (err) {
    logger.warn({ err }, "analytics: Sentry init failed");
  }
}

export function track(event: AnalyticsEvent) {
  // In no-op mode we still log at debug so traces are visible during dev.
  logger.debug({ analytics: event }, "analytics event");
}

export function captureException(err: unknown, ctx?: Record<string, unknown>) {
  logger.error({ err, ctx }, "captured exception");
  if (!sentryReady) return;
  import("@sentry/node" as string)
    .then((Sentry) => {
      Sentry.captureException(err, { extra: ctx });
    })
    .catch(() => {
      /* ignore */
    });
}
