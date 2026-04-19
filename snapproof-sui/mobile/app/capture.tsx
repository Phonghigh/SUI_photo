import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView,
  Animated,
  Linking,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { GlowBackground, GlassCard, CoralButton, CyanButton } from "../src/components/Glass";
import { C, TYPE } from "../src/theme/tokens";
import { SnapLogo } from "../src/components/SnapLogo";
import { FadeUp } from "../src/components/FadeUp";
import { ProcessState } from "../src/components/ProcessState";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { OnboardingModal } from "../src/components/OnboardingModal";
import { getAddress } from "../src/services/wallet";
import { getBalance, faucet, mintProof } from "../src/services/sui";
import { hashImage } from "../src/utils/hash";
import { track } from "../src/services/analytics";
import { SUI_NETWORK } from "../src/config";

const SEAL_STEPS = [
  { label: "Hashing image", detail: "SHA-256" },
  { label: "Signing payload", detail: "ed25519" },
  { label: "Sealing on Sui", detail: "epoch 412" },
];

export default function CaptureScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<"viewfinder" | "sealing" | "sealed">("viewfinder");
  const [step, setStep] = useState(0);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [balance, setBalance] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [proofHash, setProofHash] = useState("");
  const [txDigest, setTxDigest] = useState("");

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const addr = await getAddress();
    setWalletAddress(addr);
    const bal = await getBalance();
    setBalance((Number(bal) / 1_000_000_000).toFixed(3));
  };

  const startCapture = async () => {
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setImageUri(uri);
      runSeal(uri);
    }
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setImageUri(uri);
      runSeal(uri);
    }
  };

  const runSeal = async (uri: string) => {
    setPhase("sealing");
    setStep(0);
    
    // Simulate steps for UI fidelity
    const timer = setInterval(() => {
      setStep(s => (s < 2 ? s + 1 : s));
    }, 800);

    try {
      const hash = await hashImage(uri);
      setProofHash(hash);
      
      const loc = await Location.getCurrentPositionAsync({});
      const tx = await mintProof(hash, {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      });
      
      setTxDigest(tx.digest);
      clearInterval(timer);
      setStep(3);
      setTimeout(() => setPhase("sealed"), 600);
      track({ name: "proof_sealed", props: { network: SUI_NETWORK } });
    } catch (err) {
      console.error(err);
      clearInterval(timer);
      setPhase("viewfinder");
    }
  };

  const reset = () => {
    setPhase("viewfinder");
    setImageUri(null);
    setStep(0);
  };

  return (
    <GlowBackground topColor="rgba(240,86,110,0.28)" bottomColor="rgba(60,200,240,0.18)">
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
        
        {phase === "viewfinder" && (
          <>
            <FadeUp delay={0}>
              <View style={styles.hero}>
                <View style={styles.heroRow}>
                  <Feather name="camera" size={14} color={C.coral} style={{ marginRight: 6 }} />
                  <Text style={styles.eyebrow}>Capture</Text>
                </View>
                <Text style={styles.heroTitle}>New Proof</Text>
              </View>
            </FadeUp>

            <FadeUp delay={60}>
              <GlassCard tone="cyan" radius={24} noPad>
                <View style={styles.viewfinder}>
                  <View style={styles.viewfinderGrid}>
                    <View style={styles.gridRow}><View style={styles.gridCell}/><View style={styles.gridCell}/><View style={styles.gridCell}/></View>
                    <View style={styles.gridRow}><View style={styles.gridCell}/><View style={styles.gridCell}/><View style={styles.gridCell}/></View>
                    <View style={styles.gridRow}><View style={styles.gridCell}/><View style={styles.gridCell}/><View style={styles.gridCell}/></View>
                  </View>
                  <View style={styles.reticle}>
                    <View style={[styles.reticleCorner, { top: -2, left: -2, borderTopWidth: 2, borderLeftWidth: 2, borderColor: C.coral }]} />
                    <View style={[styles.reticleCorner, { top: -2, right: -2, borderTopWidth: 2, borderRightWidth: 2, borderColor: C.coral }]} />
                    <View style={[styles.reticleCorner, { bottom: -2, left: -2, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: C.coral }]} />
                    <View style={[styles.reticleCorner, { bottom: -2, right: -2, borderBottomWidth: 2, borderRightWidth: 2, borderColor: C.coral }]} />
                  </View>
                  <View style={styles.viewfinderOverlay}>
                    <View style={styles.liveBadge}>
                      <View style={styles.liveDot} />
                      <Text style={styles.liveText}>LIVE</Text>
                    </View>
                    <Text style={styles.resText}>4032 × 3024</Text>
                  </View>
                </View>
              </GlassCard>
            </FadeUp>

            <FadeUp delay={120}>
              <View style={styles.shutterContainer}>
                <TouchableOpacity onPress={pickFromLibrary} style={styles.toolBtn}>
                  <Feather name="image" size={20} color={C.silver} />
                </TouchableOpacity>

                <TouchableOpacity onPress={startCapture} style={styles.shutterOuter} activeOpacity={0.9}>
                  <View style={styles.shutterInner}>
                    <View style={styles.shutterCore}>
                       <Feather name="camera" size={24} color="#fff" />
                    </View>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.push("/settings")} style={styles.toolBtn}>
                  <Feather name="settings" size={20} color={C.silver} />
                </TouchableOpacity>
              </View>
            </FadeUp>

            <FadeUp delay={180}>
              <Text style={styles.hintTitle}>Frame your shot.</Text>
              <Text style={styles.hintSub}>We seal it instantly on Sui.</Text>
            </FadeUp>
          </>
        )}

        {phase === "sealing" && (
          <FadeUp delay={0}>
            <ProcessState
              title="Sealing on Sui"
              subtitle="Don't move a pixel."
              steps={SEAL_STEPS}
              currentStep={step}
              totalSteps={SEAL_STEPS.length}
              icon="sparkles"
            />
          </FadeUp>
        )}

        {phase === "sealed" && (
          <FadeUp delay={0}>
            <GlassCard radius={24}>
              <View style={styles.sealedInner}>
                <View style={styles.sealedHeader}>
                  <View style={styles.sealedBadge}>
                    <Ionicons name="checkmark-circle" size={12} color={C.mint} style={{ marginRight: 4 }} />
                    <Text style={styles.sealedBadgeText}>SEALED</Text>
                  </View>
                  <Text style={styles.epochText}>EPOCH 412</Text>
                </View>
                
                <View style={styles.sealedRow}>
                  <View style={styles.sealedPreview}>
                    {imageUri ? (
                      <Image source={{ uri: imageUri }} style={styles.sealedImg} />
                    ) : (
                      <View style={styles.sealedImgPlaceholder}>
                         <Feather name="image" size={24} color={C.slate} />
                      </View>
                    )}
                  </View>
                  <View style={styles.sealedInfo}>
                    <Text style={styles.sealedTitle}>Proof #129</Text>
                    <View style={styles.sealedMeta}>
                      <Text style={styles.sealedMetaText}>
                        <Feather name="clock" size={11} color={C.slate} /> just now
                      </Text>
                    </View>
                    <View style={styles.hashTag}>
                      <Feather name="hash" size={10} color={C.cyan} style={{ marginRight: 4 }} />
                      <Text style={styles.hashTagText} numberOfLines={1}>{proofHash?.slice(0, 16) || "0x9f2...c41a"}</Text>
                    </View>
                  </View>
                </View>

                <CoralButton onPress={reset} style={{ marginTop: 24 }}>
                  <View style={styles.btnRow}>
                    <Feather name="refresh-ccw" size={18} color="#fff" style={{ marginRight: 10 }} />
                    <Text style={styles.coralBtnText}>Capture another</Text>
                  </View>
                </CoralButton>
                
                <View style={styles.sealedActions}>
                  <CyanButton onPress={() => router.push("/map")} style={{ flex: 1 }}>
                    <View style={styles.btnRow}>
                      <Feather name="map-pin" size={16} color={C.silver} style={{ marginRight: 8 }} />
                      <Text style={styles.cyanBtnText}>Map</Text>
                    </View>
                  </CyanButton>
                  <CyanButton onPress={() => Linking.openURL(`https://suiscan.xyz/${SUI_NETWORK}/tx/${txDigest}`)} style={{ flex: 1 }}>
                    <View style={styles.btnRow}>
                      <Feather name="external-link" size={16} color={C.silver} style={{ marginRight: 8 }} />
                      <Text style={styles.cyanBtnText}>Explorer</Text>
                    </View>
                  </CyanButton>
                </View>
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
  hero: { marginBottom: 20 },
  heroRow: { flexDirection: "row", alignItems: "center" },
  eyebrow: { ...TYPE.eyebrow },
  heroTitle: { fontSize: 24, fontWeight: "800", color: C.textPrimary },
  viewfinder: {
    aspectRatio: 3 / 4,
    borderRadius: 20,
    backgroundColor: "#050813",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  viewfinderGrid: { ...StyleSheet.absoluteFillObject },
  gridRow: { flex: 1, flexDirection: "row" },
  gridCell: { flex: 1, borderColor: "rgba(255,255,255,0.05)", borderWidth: 0.5 },
  reticle: { width: 80, height: 80, borderRadius: 12 },
  reticleCorner: { position: "absolute", width: 14, height: 14 },
  viewfinderOverlay: { position: "absolute", top: 12, left: 12, right: 12, flexDirection: "row", justifyContent: "space-between" },
  liveBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.coral },
  liveText: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  resText: { color: "rgba(255,255,255,0.6)", fontSize: 10, fontFamily: "monospace" },
  shutterContainer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 32, paddingHorizontal: 10 },
  toolBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.03)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  shutterOuter: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: "rgba(240,86,110,0.15)", padding: 4,
    shadowColor: C.coral, shadowOpacity: 0.4, shadowRadius: 20,
  },
  shutterInner: {
    flex: 1, borderRadius: 40, backgroundColor: "rgba(255,255,255,0.9)", padding: 8,
  },
  shutterCore: {
    flex: 1, borderRadius: 32, backgroundColor: C.coral,
    alignItems: "center", justifyContent: "center",
  },
  hintTitle: { fontSize: 24, fontWeight: "800", color: C.textPrimary, marginTop: 24, textAlign: "center" },
  hintSub: { fontSize: 15, color: C.silver, marginTop: 4, textAlign: "center" },
  sealedInner: { padding: 4 },
  sealedHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  sealedBadge: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(64,224,163,0.1)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100,
  },
  sealedBadgeText: { color: C.mint, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  epochText: { fontSize: 10, color: C.slate, fontFamily: "monospace" },
  sealedRow: { flexDirection: "row", gap: 16 },
  sealedPreview: { width: 84, height: 84, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.03)", overflow: "hidden" },
  sealedImg: { width: "100%", height: "100%" },
  sealedImgPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  sealedInfo: { flex: 1, justifyContent: "center" },
  sealedTitle: { fontSize: 18, fontWeight: "800", color: C.textPrimary },
  sealedMeta: { marginTop: 6 },
  sealedMetaText: { fontSize: 12, color: C.slate, flexDirection: "row", alignItems: "center" },
  hashTag: {
    marginTop: 10, alignSelf: "flex-start", flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(60,200,240,0.08)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100,
  },
  hashTagText: { color: C.cyan, fontSize: 11, fontFamily: "monospace" },
  btnRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  coralBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  sealedActions: { flexDirection: "row", gap: 12, marginTop: 12 },
  cyanBtnText: { color: C.silver, fontSize: 14, fontWeight: "600" },
  builtOn: {
    marginTop: 40, textAlign: "center", fontSize: 10, fontWeight: "600",
    textTransform: "uppercase", letterSpacing: 3, color: "rgba(132,142,160,0.4)",
  },
});
