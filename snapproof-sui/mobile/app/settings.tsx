import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Switch, ScrollView } from "react-native";
import { Stack } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { logger } from "../src/utils/logger";
import { track } from "../src/services/analytics";
import { loadSettings, saveSettings, type AppSettings } from "../src/services/settings";

const TELEMETRY_KEY = "snapproof_telemetry_optin";

export default function SettingsScreen() {
  const [telemetryEnabled, setTelemetryEnabled] = useState(true); // Default ON
  const [settings, setSettings] = useState<AppSettings>({
    cameraOnlyMode: false,
    hasSeenOnboarding: false,
  });

  useEffect(() => {
    loadAllSettings();
    track({ name: "settings_opened" });
  }, []);

  const loadAllSettings = async () => {
    try {
      const stored = await SecureStore.getItemAsync(TELEMETRY_KEY);
      if (stored === "false") {
        setTelemetryEnabled(false);
      }
      const appSettings = await loadSettings();
      setSettings(appSettings);
    } catch (e) {
      logger.error("SETTINGS", "Failed to load settings", { error: String(e) });
    }
  };

  const handleTelemetryToggle = async (value: boolean) => {
    setTelemetryEnabled(value);
    try {
      await SecureStore.setItemAsync(TELEMETRY_KEY, value ? "true" : "false");
      track({ name: "settings_changed", props: { key: "telemetry", value } });
      // Re-initialize analytics dynamically without app restart
      const { initAnalytics } = await import("../src/services/analytics");
      await initAnalytics();
    } catch (e) {
      logger.error("SETTINGS", "Failed to save settings", { error: String(e) });
    }
  };

  const handleCameraOnlyToggle = async (value: boolean) => {
    try {
      const next = await saveSettings({ cameraOnlyMode: value });
      setSettings(next);
      track({ name: "settings_changed", props: { key: "cameraOnlyMode", value } });
    } catch (e) {
      logger.error("SETTINGS", "Failed to save camera-only", { error: String(e) });
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Settings" }} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Capture</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingTitle}>Camera-Only Mode</Text>
            <Text style={styles.settingDescription}>
              When on, only photos taken live with the camera can be submitted.
              Library picking is disabled — a stronger guarantee that the image
              was captured in the moment, not a pre-existing file.
            </Text>
          </View>
          <Switch
            value={settings.cameraOnlyMode}
            onValueChange={handleCameraOnlyToggle}
            trackColor={{ false: "#767577", true: "#4ecca3" }}
            thumbColor={settings.cameraOnlyMode ? "#fff" : "#f4f3f4"}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy & Data</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingTitle}>Crash Reporting & Analytics</Text>
            <Text style={styles.settingDescription}>
              Help us improve SnapProof by anonymously reporting crashes and basic usage data (e.g., how often proofs succeed or fail).
              {"\n\n"}
              We NEVER track personal information, image contents, or precise GPS locations.
            </Text>
          </View>
          <Switch
            value={telemetryEnabled}
            onValueChange={handleTelemetryToggle}
            trackColor={{ false: "#767577", true: "#4ecca3" }}
            thumbColor={telemetryEnabled ? "#fff" : "#f4f3f4"}
          />
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>SnapProof v0.1.0 (Beta)</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    color: "#5dade2",
    fontSize: 14,
    fontWeight: "bold",
    textTransform: "uppercase",
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    backgroundColor: "#16213e",
    padding: 16,
    borderRadius: 12,
  },
  settingTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  settingDescription: {
    color: "#aaa",
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    alignItems: "center",
    marginTop: 40,
  },
  footerText: {
    color: "#555",
    fontSize: 12,
  },
});
