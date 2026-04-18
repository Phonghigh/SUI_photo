/**
 * Mobile analytics + error reporting.
 *
 * Mirrors the backend pattern: Sentry is optional. If @sentry/react-native is
 * installed AND EXPO_PUBLIC_SENTRY_DSN is set, captureException / addBreadcrumb
 * delegate to Sentry. Otherwise they no-op (with a console log in __DEV__).
 *
 * `track()` emits a structured analytics event. Today it writes to the
 * console/breadcrumbs; swap in PostHog/Segment/Amplitude by updating the
 * `emitEvent` function only.
 *
 * EVENT CATALOG (keep names stable; downstream dashboards depend on them):
 *   app_opened                      — first render in _layout
 *   proof_submit_started            — capture submit button pressed
 *   proof_submit_succeeded          — tx confirmed, receipt rendered
 *   proof_submit_failed             — any submit-flow error (props.stage)
 *   verify_started                  — user taps Verify
 *   verify_result                   — props.result: "match" | "mismatch" | "not_found"
 *   wallet_funded                   — balance observed > 0 for first time
 *   faucet_requested                — user tapped Faucet
 *   share_tapped                    — user tapped share link on receipt
 *   permission_granted              — props.permission, props.result
 */

import { Platform } from "react-native";
import { logger } from "../utils/logger";

type Primitive = string | number | boolean | null | undefined;
export type AnalyticsProps = Record<string, Primitive>;

export interface AnalyticsEvent {
  name: string;
  props?: AnalyticsProps;
}

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? "";
const APP_VERSION = process.env.EXPO_PUBLIC_APP_VERSION ?? "0.1.0";

type SentryLike = {
  init: (opts: Record<string, unknown>) => void;
  captureException: (err: unknown, context?: Record<string, unknown>) => void;
  captureMessage: (msg: string, level?: string) => void;
  addBreadcrumb: (b: Record<string, unknown>) => void;
  setUser: (u: Record<string, unknown> | null) => void;
};

let sentry: SentryLike | null = null;
let initialized = false;

/**
 * Initialize analytics. Safe to call multiple times (idempotent).
 * Call once from app/_layout.tsx on first mount.
 */
export async function initAnalytics(): Promise<void> {
  if (initialized) return;
  initialized = true;

  if (!SENTRY_DSN) {
    logger.info("ANALYTICS", "SENTRY_DSN not set — Sentry disabled (no-op mode)");
    return;
  }

  try {
    // Dynamic import: Sentry is an optional dependency.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = await import("@sentry/react-native" as string).catch(() => null);
    if (!mod) {
      logger.warn("ANALYTICS", "@sentry/react-native not installed — falling back to console");
      return;
    }
    sentry = mod as unknown as SentryLike;
    sentry.init({
      dsn: SENTRY_DSN,
      enableAutoSessionTracking: true,
      tracesSampleRate: 0.1,
      environment: __DEV__ ? "development" : "production",
      release: `snapproof-mobile@${APP_VERSION}`,
    });
    logger.info("ANALYTICS", "Sentry initialized");
  } catch (err) {
    logger.warn("ANALYTICS", "Sentry init failed", { err: String(err) });
    sentry = null;
  }
}

/**
 * Emit a structured analytics event.
 * Non-blocking, always safe (never throws).
 */
export function track(event: AnalyticsEvent): void {
  try {
    emitEvent(event);
    if (sentry) {
      sentry.addBreadcrumb({
        category: "analytics",
        type: "info",
        message: event.name,
        data: event.props ?? {},
        level: "info",
      });
    }
  } catch {
    // never let analytics crash the app
  }
}

/**
 * Capture an exception (sent to Sentry if configured, otherwise logged).
 */
export function captureException(err: unknown, context?: Record<string, Primitive>): void {
  try {
    logger.error("ANALYTICS", "captured exception", {
      err: err instanceof Error ? err.message : String(err),
      context,
    });
    if (sentry) {
      sentry.captureException(err, { extra: context ?? {} });
    }
  } catch {
    // swallow
  }
}

/**
 * Set the current user identifier (wallet address).
 * Never sends PII — just the public Sui address.
 */
export function setUser(walletAddress: string | null): void {
  try {
    if (sentry) {
      sentry.setUser(walletAddress ? { id: walletAddress } : null);
    }
  } catch {
    // swallow
  }
}

// --- internals ---

function emitEvent(event: AnalyticsEvent): void {
  // Swap this function body to plug in PostHog / Segment / Amplitude.
  logger.info("EVENT", event.name, {
    platform: Platform.OS,
    ...(event.props ?? {}),
  });
}
