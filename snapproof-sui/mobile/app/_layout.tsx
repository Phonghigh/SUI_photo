import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { initAnalytics, track } from "../src/services/analytics";

export default function RootLayout() {
  useEffect(() => {
    // Fire-and-forget: initialize Sentry (if configured) and emit app_opened.
    initAnalytics().then(() => {
      track({ name: "app_opened" });
  });
  }, []);

  return (
    <>
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
      </Stack>
    </>
  );
}
