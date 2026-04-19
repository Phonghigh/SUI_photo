import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { GlowBackground, GlassCard, CyanButton, CoralButton } from "../src/components/Glass";
import { C, TYPE } from "../src/theme/tokens";
import { FadeUp } from "../src/components/FadeUp";
import { getSettings, updateSettings, type AppSettings } from "../src/services/settings";
import { exportSecretKey } from "../src/services/wallet";
import * as Clipboard from "expo-clipboard";
import { Feather } from "@expo/vector-icons";

export default function SettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const s = await getSettings();
    setSettings(s);
    setLoading(false);
  };

  const toggleCameraOnly = async (val: boolean) => {
    if (settings) {
      const updated = { ...settings, cameraOnlyMode: val };
      setSettings(updated);
      await updateSettings(updated);
    }
  };

  const handleExportKey = async () => {
    const key = await exportSecretKey();
    if (key) {
      await Clipboard.setStringAsync(key);
      Alert.alert("Success", "Secret key copied to clipboard. Keep it safe!");
    }
  };

  if (loading) return null;

  return (
    <GlowBackground topColor="rgba(60,200,240,0.2)" bottomColor="rgba(240,86,110,0.15)">
      <Stack.Screen
        options={{
          headerTransparent: true,
          headerTitle: "",
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Feather name="arrow-left" size={20} color={C.silver} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        
        <FadeUp delay={0}>
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>Preferences</Text>
            <Text style={styles.heroTitle}>Settings</Text>
          </View>
        </FadeUp>

        <FadeUp delay={60}>
          <Text style={styles.sectionTitle}>Application</Text>
          <GlassCard radius={24} noPad>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Camera-Only Mode</Text>
                <Text style={styles.settingSub}>Disable library imports for higher integrity</Text>
              </View>
              <Switch
                value={settings?.cameraOnlyMode}
                onValueChange={toggleCameraOnly}
                trackColor={{ false: "#1a1a2e", true: C.mint }}
                thumbColor="#fff"
              />
            </View>
          </GlassCard>
        </FadeUp>

        <FadeUp delay={120}>
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Security</Text>
          <GlassCard radius={24} noPad>
            <TouchableOpacity style={styles.actionRow} onPress={handleExportKey}>
              <View style={styles.actionIcon}>
                <Feather name="key" size={18} color={C.coral} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionLabel}>Export Private Key</Text>
                <Text style={styles.actionSub}>Copy your Sui wallet secret key</Text>
              </View>
              <Feather name="chevron-right" size={18} color={C.slate} />
            </TouchableOpacity>
          </GlassCard>
        </FadeUp>

        <FadeUp delay={180}>
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>About</Text>
          <GlassCard radius={24} noPad>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Version</Text>
              <Text style={styles.infoValue}>0.1.0 (Alpha)</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Network</Text>
              <Text style={styles.infoValue}>Sui Testnet</Text>
            </View>
          </GlassCard>
        </FadeUp>

        <FadeUp delay={240}>
          <CoralButton style={{ marginTop: 32 }} onPress={() => router.replace("/")}>
            <Text style={styles.coralBtnText}>Return Home</Text>
          </CoralButton>
        </FadeUp>

        <Text style={styles.builtOn}>Built on Sui</Text>
      </ScrollView>
    </GlowBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingTop: Platform.OS === "ios" ? 110 : 90,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(20,28,52,0.65)", borderWidth: 1, borderColor: C.glassBorder,
    alignItems: "center", justifyContent: "center", marginLeft: 16,
  },
  backIcon: { color: C.silver, fontSize: 20 },
  hero: { marginBottom: 28 },
  eyebrow: { ...TYPE.eyebrow, marginBottom: 4 },
  heroTitle: { fontSize: 32, fontWeight: "800", color: C.textPrimary },
  sectionTitle: { ...TYPE.eyebrow, marginLeft: 4, marginBottom: 12 },
  settingRow: { flexDirection: "row", alignItems: "center", padding: 20 },
  settingLabel: { fontSize: 16, fontWeight: "700", color: C.textPrimary },
  settingSub: { fontSize: 12, color: C.slate, marginTop: 2 },
  actionRow: { flexDirection: "row", alignItems: "center", padding: 20, gap: 16 },
  actionIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.03)", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  actionLabel: { fontSize: 15, fontWeight: "700", color: C.textPrimary },
  actionSub: { fontSize: 11, color: C.slate, marginTop: 2 },
  arrow: { color: C.slate, fontSize: 18 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20 },
  infoLabel: { fontSize: 15, fontWeight: "600", color: C.silver },
  infoValue: { fontSize: 14, color: C.slate, fontFamily: "monospace" },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.05)", marginHorizontal: 20 },
  coralBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  builtOn: {
    marginTop: 40, textAlign: "center", fontSize: 10, fontWeight: "600",
    textTransform: "uppercase", letterSpacing: 3, color: "rgba(132,142,160,0.4)",
  },
});
