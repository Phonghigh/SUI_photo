/**
 * App-level user settings. Persisted via expo-secure-store on native, and
 * localStorage on web. Values survive cold-starts but never leave the device.
 *
 * Keep values minimal: each setting adds cognitive load. Add one only when
 * it materially changes behavior (not for styling).
 */

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { logger } from "../utils/logger";

export interface AppSettings {
  /**
   * When true, the capture screen disables "Pick from Library" and
   * only accepts photos taken live with the camera. Raises the bar
   * against submitting pre-existing images as fresh evidence.
   */
  cameraOnlyMode: boolean;

  /**
   * When true, the user has completed the first-launch onboarding flow.
   * Drives whether the 3-screen walkthrough is shown.
   */
  hasSeenOnboarding: boolean;
}

const KEY = "snapproof.settings.v1";
const DEFAULTS: AppSettings = {
  cameraOnlyMode: false,
  hasSeenOnboarding: false,
};

async function readRaw(): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
    } catch {
      return null;
    }
  }
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

async function writeRaw(value: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(KEY, value);
    } catch {
      /* no-op */
    }
    return;
  }
  try {
    await SecureStore.setItemAsync(KEY, value);
  } catch (err) {
    logger.warn("SETTINGS", "failed to persist settings", { err: String(err) });
  }
}

export async function loadSettings(): Promise<AppSettings> {
  const raw = await readRaw();
  if (!raw) return { ...DEFAULTS };
  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveSettings(
  patch: Partial<AppSettings>
): Promise<AppSettings> {
  const current = await loadSettings();
  const next = { ...current, ...patch };
  await writeRaw(JSON.stringify(next));
  return next;
}
