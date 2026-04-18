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
 *   copy_link_tapped                — user tapped "Copy Link" on receipt
 *   permission_granted              — props.permission, props.result
 *   image_hashed                    — image hash computed (props.source)
 *   settings_opened / settings_changed  — user visited settings
 *   outbox_enqueued / outbox_processed  — offline queue lifecycle
 */

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { logger } from "../utils/logger";

type Primitive = string | number | boolean | null | undefined;
export type AnalyticsProps = Record<string, Primitive>;

export interface AnalyticsEvent {
  name: string;
  props?: AnalyticsProps;
}

const APP_VERSION = process.env.EXPO_PUBLIC_APP_VERSION ?? "0.1.0";
const TELEMETRY_KEY = "snapproof_telemetry_optin";

let initialized = false;
let isTelemetryEnabled = true;

/**
 * Initialize analytics. Safe to call multiple times (idempotent).
 */
export async function initAnalytics(): Promise<void> {
  try {
    const stored = await SecureStore.getItemAsync(TELEMETRY_KEY);
    isTelemetryEnabled = stored !== "false";
  } catch {
    isTelemetryEnabled = true; // default on
  }

  if (initialized) return;
  initialized = true;

  logger.info("ANALYTICS", "Analytics initialized", { telemetry: isTelemetryEnabled });
}

/**
 * Emit a structured analytics event.
 */
export function track(event: AnalyticsEvent): void {
  if (!isTelemetryEnabled) return;
  try {
    emitEvent(event);
  } catch {
    // never let analytics crash the app
  }
}

/**
 * Capture an exception (logged locally).
 */
export function captureException(
  err: unknown,
  context?: Record<string, Primitive>
): void {
  if (!isTelemetryEnabled) return;
  try {
    logger.error("ANALYTICS", "captured exception", {
      err: err instanceof Error ? err.message : String(err),
      context,
    });
  } catch {
    // swallow
  }
}

/**
 * Set the current user identifier (log only).
 */
export function setUser(walletAddress: string | null): void {
  if (!isTelemetryEnabled) return;
  try {
    logger.debug("ANALYTICS", "setUser", { walletAddress });
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
