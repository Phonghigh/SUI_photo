import "../src/polyfills";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import NetInfo from "@react-native-community/netinfo";
import { initAnalytics, track } from "../src/services/analytics";
import { processQueue } from "../src/services/outbox";
import { activateKeepAwakeAsync } from "expo-keep-awake";

export default function RootLayout() {
  useEffect(() => {
    // Fire-and-forget: initialize Sentry (if configured) and emit app_opened.
    initAnalytics().then(() => {
      track({ name: "app_opened" });
    });

    // Listen for network connectivity to auto-retry outbox
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        processQueue().catch(() => {});
      }
    });

    // Suppress "Unable to activate keep awake" warning by catching it
    activateKeepAwakeAsync().catch(() => {});

    return () => unsubscribe();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#1a1a2e" },
          headerTintColor: "#fff",
          headerTitleStyle: { fontWeight: "bold" },
        }}
      >
        <Stack.Screen name="index" options={{ title: "SnapProof" }} />
        <Stack.Screen name="capture" options={{ title: "Capture" }} />
        <Stack.Screen name="proof" options={{ title: "Proof Details" }} />
        <Stack.Screen name="verify" options={{ title: "Verify" }} />
        <Stack.Screen name="map" options={{ title: "Proof Map" }} />
        <Stack.Screen name="outbox" options={{ title: "Outbox" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
