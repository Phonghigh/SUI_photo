import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  ScrollView,
  Linking,
  TextInput,
} from "react-native";
import { useRouter, Stack, Link } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Feather, Ionicons } from "@expo/vector-icons";
import { GlowBackground, GlassCard, CoralButton, CyanButton } from "../src/components/Glass";
import { C, TYPE } from "../src/theme/tokens";
import { FadeUp } from "../src/components/FadeUp";
import { ProcessState } from "../src/components/ProcessState";
import { hashImage } from "../src/utils/hash";
import { lookupProofByImageHash, getProofById } from "../src/services/sui";
import { SUI_NETWORK } from "../src/config";

const SCAN_STEPS = [
  { label: "Reading pixels", detail: "decode" },
  { label: "Computing hash", detail: "SHA-256" },
  { label: "Querying Sui", detail: "lookup" },
];

export default function VerifyScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "scanning" | "match" | "mismatch" | "not_found">("idle");
  const [step, setStep] = useState(0);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [computedHash, setComputedHash] = useState("");
  const [foundProof, setFoundProof] = useState<any>(null);

  const startVerify = async (uri: string) => {
    setImageUri(uri);
    setPhase("scanning");
    setStep(0);

    const timer = setInterval(() => {
      setStep(s => (s < 2 ? s + 1 : s));
    }, 700);

    try {
      const hash = await hashImage(uri);
      setComputedHash(hash);
      const lookup = await lookupProofByImageHash(hash);
      
      clearInterval(timer);
      setStep(3);
      
      setTimeout(async () => {
        if (lookup) {
          const proof = lookup.proofId ? await getProofById(lookup.proofId) : null;
          setFoundProof(proof);
          setPhase("match");
        } else {
          setPhase("not_found");
        }
      }, 500);
    } catch (err) {
      clearInterval(timer);
      setPhase("idle");
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      startVerify(result.assets[0].uri);
    }
  };

  const reset = () => {
    setPhase("idle");
    setImageUri(null);
    setStep(0);
  };

  return (
    <GlowBackground topColor="rgba(60,200,240,0.28)" bottomColor="rgba(240,86,110,0.18)">
      <Stack.Screen
        options={{
          headerTransparent: true,
          headerTitle: "",
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Feather name="arrow-left" size={20} color={C.silver} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <View style={styles.statusChip}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Live</Text>
            </View>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        
        {phase === "idle" && (
          <>
            <FadeUp delay={0}>
              <View style={styles.hero}>
                <Text style={styles.eyebrow}>Verify</Text>
                <Text style={styles.heroTitle}>Check Authenticity</Text>
              </View>
            </FadeUp>

            <FadeUp delay={60}>
              <TouchableOpacity onPress={pickImage} activeOpacity={0.85}>
                <GlassCard tone="cyan" style={styles.dropZone} radius={24} noPad>
                  <View style={styles.dropInner}>
                    <View style={styles.uploadIconWrap}>
                      <Feather name="upload" size={24} color={C.cyan} />
                    </View>
                    <Text style={styles.dropTitle}>Drop or browse</Text>
                    <Text style={styles.dropSub}>JPG, PNG, HEIC</Text>
                  </View>
                </GlassCard>
              </TouchableOpacity>
            </FadeUp>

            <FadeUp delay={120}>
              <Text style={[styles.eyebrow, { marginTop: 24, marginBottom: 12 }]}>Try a sample</Text>
              <GlassCard radius={20} noPad>
                <TouchableOpacity style={styles.sampleRow} activeOpacity={0.7}>
                  <View style={styles.sampleIcon}>
                    <Feather name="image" size={16} color={C.mint} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sampleLabel}>Mountain sunrise.heic</Text>
                    <Text style={styles.sampleMeta}>Sealed · 2m ago</Text>
                  </View>
                  <Text style={styles.verifyArrow}>verify →</Text>
                </TouchableOpacity>
                <View style={styles.divider} />
                <TouchableOpacity style={styles.sampleRow} activeOpacity={0.7}>
                  <View style={[styles.sampleIcon, { backgroundColor: "rgba(240,86,110,0.1)" }]}>
                    <Feather name="alert-triangle" size={16} color={C.coral} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sampleLabel}>Press conference.jpg</Text>
                    <Text style={styles.sampleMeta}>Edited · pixels altered</Text>
                  </View>
                  <Text style={styles.verifyArrow}>verify →</Text>
                </TouchableOpacity>
              </GlassCard>
            </FadeUp>

            <FadeUp delay={180}>
              <View style={styles.noteBox}>
                <Feather name="sparkles" size={16} color={C.cyan} />
                <Text style={styles.noteText}>
                  We compare the photo's hash to the receipt sealed on <Text style={{ color: C.silver }}>Sui</Text>.
                  No upload to a server — verification runs locally.
                </Text>
              </View>
            </FadeUp>
          </>
        )}

        {phase === "scanning" && (
          <FadeUp delay={0}>
            <ProcessState
              title="Verifying"
              subtitle="Checking the seal..."
              steps={SCAN_STEPS}
              currentStep={step}
              totalSteps={SCAN_STEPS.length}
              icon="shield"
            />
          </FadeUp>
        )}

        {phase === "match" && (
          <FadeUp delay={0}>
            <GlassCard radius={24}>
              <View style={styles.resultInner}>
                <View style={styles.resultHeader}>
                  <View style={styles.matchBadge}>
                    <Ionicons name="shield-checkmark" size={12} color={C.mint} style={{ marginRight: 4 }} />
                    <Text style={styles.matchBadgeText}>AUTHENTIC</Text>
                  </View>
                  <Text style={styles.epochText}>EPOCH 412</Text>
                </View>

                <View style={styles.resultRow}>
                  <View style={styles.resultIconWrap}>
                    <Feather name="shield" size={24} color={C.mint} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultTitle}>Hash matches the seal.</Text>
                    <Text style={styles.resultSub} numberOfLines={1}>{imageUri?.split("/").pop()}</Text>
                  </View>
                </View>

                <View style={styles.metaGrid}>
                  <View style={styles.metaCell}>
                    <Text style={styles.metaLabel}>SEALED</Text>
                    <Text style={styles.metaValue}>{foundProof?.createdAt ? new Date(foundProof.createdAt).toLocaleDateString() : "2m ago"}</Text>
                  </View>
                  <View style={styles.metaCell}>
                    <Text style={styles.metaLabel}>ORIGIN</Text>
                    <Text style={styles.metaValue}>San Francisco</Text>
                  </View>
                </View>

                <View style={styles.hashBar}>
                  <Text style={styles.hashBarText} numberOfLines={1}>#{computedHash}</Text>
                </View>

                <View style={styles.actionRow}>
                  <CyanButton style={{ flex: 1 }}>
                    <View style={styles.btnRow}>
                      <Feather name="external-link" size={16} color={C.silver} style={{ marginRight: 8 }} />
                      <Text style={styles.cyanBtnText}>Explorer</Text>
                    </View>
                  </CyanButton>
                  <CoralButton onPress={reset} style={{ flex: 1 }}>
                    <View style={styles.btnRow}>
                      <Feather name="refresh-ccw" size={16} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.coralBtnText}>Verify another</Text>
                    </View>
                  </CoralButton>
                </View>
              </View>
            </GlassCard>
          </FadeUp>
        )}

        {phase === "not_found" && (
          <FadeUp delay={0}>
            <GlassCard radius={24}>
              <View style={styles.resultInner}>
                <View style={[styles.matchBadge, { backgroundColor: "rgba(255,255,255,0.05)" }]}>
                   <Feather name="help-circle" size={12} color={C.slate} style={{ marginRight: 4 }} />
                  <Text style={[styles.matchBadgeText, { color: C.slate }]}>NOT FOUND</Text>
                </View>
                <Text style={[styles.resultTitle, { marginTop: 16 }]}>No proof on Sui.</Text>
                <Text style={styles.resultText}>No on-chain proof was found for this image. It may not have been sealed with SnapProof.</Text>
                <CoralButton onPress={reset} style={{ marginTop: 20 }}>
                  <View style={styles.btnRow}>
                    <Feather name="refresh-ccw" size={16} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.coralBtnText}>Try another</Text>
                  </View>
                </CoralButton>
              </View>
            </GlassCard>
          </FadeUp>
        )}

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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(20,28,52,0.65)",
    borderWidth: 1,
    borderColor: C.glassBorder,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 16,
  },
  backIcon: { color: C.silver, fontSize: 20 },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: C.glassBorder,
    backgroundColor: "rgba(20,28,52,0.65)",
    marginRight: 16,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.mint },
  statusText: { color: C.silver, fontSize: 12, fontWeight: "600" },
  hero: { marginBottom: 24 },
  eyebrow: { ...TYPE.eyebrow, marginBottom: 4 },
  heroTitle: { fontSize: 24, fontWeight: "800", color: C.textPrimary },
  dropZone: { marginTop: 8 },
  dropInner: { alignItems: "center", justifyContent: "center", paddingVertical: 48 },
  uploadIconWrap: {
    width: 56, height: 56, borderRadius: 16, marginBottom: 16,
    backgroundColor: "rgba(60,200,240,0.12)", borderWidth: 1, borderColor: "rgba(60,200,240,0.3)",
    alignItems: "center", justifyContent: "center",
  },
  dropTitle: { fontSize: 16, fontWeight: "700", color: C.textPrimary, marginBottom: 4 },
  dropSub: { fontSize: 12, color: C.slate },
  sampleRow: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  sampleIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "rgba(64,224,163,0.1)", alignItems: "center", justifyContent: "center",
  },
  sampleLabel: { fontSize: 14, fontWeight: "700", color: C.textPrimary },
  sampleMeta: { fontSize: 11, color: C.slate, marginTop: 2 },
  verifyArrow: { fontSize: 11, color: C.slate, fontFamily: "monospace" },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.05)", marginHorizontal: 16 },
  noteBox: {
    flexDirection: "row", gap: 12, marginTop: 20,
    backgroundColor: "rgba(255,255,255,0.02)", borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.05)", alignItems: "center",
  },
  noteText: { flex: 1, fontSize: 12, color: C.slate, lineHeight: 18 },
  resultInner: { padding: 4 },
  resultHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  matchBadge: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(64,224,163,0.12)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100,
  },
  matchBadgeText: { color: C.mint, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  epochText: { fontSize: 10, color: C.slate, fontFamily: "monospace" },
  resultRow: { flexDirection: "row", gap: 16, alignItems: "center", marginBottom: 20 },
  resultIconWrap: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: "rgba(64,224,163,0.12)", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(64,224,163,0.25)",
  },
  resultTitle: { fontSize: 18, fontWeight: "800", color: C.textPrimary },
  resultSub: { fontSize: 12, color: C.slate, marginTop: 2, fontFamily: "monospace" },
  metaGrid: { flexDirection: "row", gap: 12, marginBottom: 12 },
  metaCell: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 16,
    padding: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)",
  },
  metaLabel: { ...TYPE.eyebrow, fontSize: 9, marginBottom: 4 },
  metaValue: { fontSize: 14, fontWeight: "700", color: C.textPrimary },
  hashBar: {
    backgroundColor: "rgba(20,28,52,0.55)", borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: C.glassBorder, marginBottom: 20,
  },
  hashBarText: { color: C.silver, fontSize: 11, fontFamily: "monospace" },
  actionRow: { flexDirection: "row", gap: 12 },
  btnRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  coralBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  cyanBtnText: { color: C.silver, fontSize: 14, fontWeight: "600" },
  resultText: { fontSize: 14, color: C.silver, lineHeight: 22, marginTop: 8 },
  builtOn: {
    marginTop: 40, textAlign: "center", fontSize: 10, fontWeight: "600",
    textTransform: "uppercase", letterSpacing: 3, color: "rgba(132,142,160,0.4)",
  },
});
