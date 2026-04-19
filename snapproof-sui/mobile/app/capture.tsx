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
import { useRouter, Stack, Link } from "expo-router";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlowBackground, GlassCard, CoralButton, CyanButton, StatusPill, PageHeader } from "../src/components/Glass";
import { C, TYPE } from "../src/theme/tokens";
import { SnapLogo } from "../src/components/SnapLogo";
import { FadeUp } from "../src/components/FadeUp";
import { ProcessState } from "../src/components/ProcessState";
import { Feather, Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { OnboardingModal } from "../src/components/OnboardingModal";
import { getAddress } from "../src/services/wallet";
import { getBalance, faucet, mintProof } from "../src/services/sui";
import { hashImage } from "../src/utils/hash";
import { encodeGeohash } from "../src/utils/geohash";
import { track } from "../src/services/analytics";
import { SUI_NETWORK } from "../src/config";
import { uploadToWalrus } from "../src/services/walrus";

const SEAL_STEPS = [
  { label: "Hashing image", detail: "SHA-256" },
  { label: "Signing payload", detail: "ed25519" },
  { label: "Sealing on Sui", detail: "epoch 412" },
];

export default function CaptureScreen() {
  const router = useRouter();
  const networkLabel =
    SUI_NETWORK.charAt(0).toUpperCase() + SUI_NETWORK.slice(1);
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const [phase, setPhase] = useState<"viewfinder" | "sealing" | "sealed">("viewfinder");
  const [step, setStep] = useState(0);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [balance, setBalance] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [proofHash, setProofHash] = useState("");
  const [txDigest, setTxDigest] = useState("");
  
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // Auto-open the native camera exactly once on mount. If the user cancels,
  // they fall back to the viewfinder card and can re-tap the shutter manually.
  const autoOpenedRef = useRef(false);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    // Camera permission first
    if (!permission?.granted) {
      await requestPermission();
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn("Location permission denied");
    }

    await refreshBalance();
  };

  const refreshBalance = async () => {
    try {
      const addr = await getAddress();
      setWalletAddress(addr);
      const bal = await getBalance();
      setBalance((Number(bal) / 1_000_000_000).toFixed(3));
    } catch {
      /* silent */
    }
  };




  const startCapture = async () => {
    if (cameraRef.current) {
      try {
        const result = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
          exif: false,
        });
        if (result && result.uri) {
          setImageUri(result.uri);
          runSeal(result.uri);
        }
      } catch (err) {
        console.error("Camera error:", err);
      }
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
      const geohash = encodeGeohash(loc.coords.latitude, loc.coords.longitude);

      // Real Walrus upload
      const { blobId } = await uploadToWalrus(uri);

      const tx = await mintProof({
        imageHash: hash,
        metadataHash: hash,
        proofHash: hash,
        walrusBlobId: blobId,
        createdAt: Date.now(),
        coarseGeoHash: geohash,
      });
      
      setTxDigest(tx.txDigest);
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
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}

        showsVerticalScrollIndicator={false}
      >
        <PageHeader 
          title="Capture" 
          rightElement={
            <TouchableOpacity onPress={refreshBalance} activeOpacity={0.7}>
              <GlassCard radius={12} tone="cyan" style={{ paddingHorizontal: 10, paddingVertical: 4 }}>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 8, fontWeight: "700", color: C.slate }}>SUI</Text>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: C.textPrimary }}>{balance || "0.000"}</Text>
                </View>
              </GlassCard>
            </TouchableOpacity>
          }
        />

        
        {phase === "viewfinder" && (
          <>
            {/* Hero section removed - title is in PageHeader */}

            <FadeUp delay={60}>
              <GlassCard tone="cyan" radius={24} noPad>
                <View style={styles.viewfinder}>
                  {permission?.granted ? (
                    <CameraView 
                      ref={cameraRef}
                      style={StyleSheet.absoluteFill}
                      facing="back"
                    />
                  ) : (
                    <View style={styles.noPermission}>
                      <Feather name="camera-off" size={32} color={C.slate} />
                      <Text style={styles.noPermissionText}>Camera access needed</Text>
                    </View>
                  )}
                  
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
            <GlassCard radius={28} tone="cyan">
              <View style={styles.receiptContainer}>
                {/* Header Badge */}
                <View style={styles.receiptHeader}>
                  <View style={styles.successBadge}>
                    <Ionicons name="shield-checkmark" size={16} color={C.mint} />
                    <Text style={styles.successText}>OFFICIALLY SEALED</Text>
                  </View>
                  <Text style={styles.epochLabel}>SUI EPOCH 412</Text>
                </View>

                {/* Main Content */}
                <View style={styles.receiptMain}>
                  <View style={styles.receiptMedia}>
                    {imageUri ? (
                      <Image
                        source={{ uri: imageUri }}
                        style={styles.receiptImg}
                        accessible={true}
                        accessibilityRole="image"
                        accessibilityLabel="Photo just captured, sealed on Sui"
                      />
                    ) : (
                      <View style={styles.imgPlaceholder}>
                         <Feather name="image" size={32} color={C.slate} />
                      </View>
                    )}
                    <View style={styles.imgOverlay}>
                      <View style={styles.verifiedStamp}>
                        <Ionicons name="checkmark-circle" size={14} color="#fff" />
                        <Text style={styles.stampText}>VERIFIED</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.receiptBody}>
                    <Text style={styles.receiptTitle}>Proof #{Math.floor(Math.random() * 900) + 100}</Text>
                    
                    <View style={styles.metaGrid}>
                      <View style={styles.metaItem}>
                        <Feather name="clock" size={12} color={C.slate} />
                        <Text style={styles.metaValue}>Just now</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Feather name="map-pin" size={12} color={C.slate} />
                        <Text style={styles.metaValue} numberOfLines={1}>Testnet Node #4</Text>
                      </View>
                    </View>

                    <View style={styles.hashBox}>
                      <View style={styles.hashRow}>
                        <Text style={styles.hashLabel}>CONTENT HASH</Text>
                        <TouchableOpacity onPress={() => Clipboard.setStringAsync(proofHash || "")}>
                          <Feather name="copy" size={10} color={C.cyan} />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.hashString} numberOfLines={1}>
                        {proofHash || "0x9f2a71b...c41a"}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Footer divider */}
                <View style={styles.divider} />

                {/* Action Buttons */}
                <View style={styles.receiptActions}>
                  <CoralButton onPress={reset} style={styles.primaryAction}>
                    <View style={styles.btnRow}>
                      <Feather name="plus-circle" size={18} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.coralBtnText}>Seal Another</Text>
                    </View>
                  </CoralButton>
                  
                  <View style={styles.secondaryActions}>
                    <CyanButton onPress={() => router.push("/map")} style={{ flex: 1 }}>
                      <View style={styles.btnRow}>
                        <Feather name="map" size={14} color={C.silver} style={{ marginRight: 6 }} />
                        <Text style={styles.cyanBtnText}>Proof Map</Text>
                      </View>
                    </CyanButton>
                    <CyanButton onPress={() => Linking.openURL(`https://suiscan.xyz/${SUI_NETWORK}/tx/${txDigest}`)} style={{ flex: 1 }}>
                      <View style={styles.btnRow}>
                        <Feather name="external-link" size={14} color={C.silver} style={{ marginRight: 6 }} />
                        <Text style={styles.cyanBtnText}>SuiScan</Text>
                      </View>
                    </CyanButton>
                  </View>
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
    // paddingTop is applied dynamically from useHeaderHeight() in the component.
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 32,
  },
  hero: {
    marginBottom: 0,
  },
  balanceCard: {
    padding: 0,
  },
  balanceInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 12,
  },
  balanceLabel: {
    ...TYPE.eyebrow,
    fontSize: 8,
    marginBottom: 2,
  },
  balanceValue: {
    color: C.textPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.mint },
  statusText: { color: C.silver, fontSize: 12, fontWeight: "600" },

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
  noPermission: { alignItems: "center", justifyContent: "center", gap: 8 },
  noPermissionText: { color: C.slate, fontSize: 12, fontWeight: "600" },
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
  receiptContainer: { padding: 4 },
  receiptHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  successBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(64,224,163,0.1)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100 },
  successText: { color: C.mint, fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
  epochLabel: { fontSize: 9, color: C.slate, fontFamily: "monospace", opacity: 0.6 },
  
  receiptMain: { flexDirection: "row", gap: 20, marginBottom: 24 },
  receiptMedia: { width: 100, height: 120, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.03)", overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  receiptImg: { width: "100%", height: "100%" },
  imgPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  imgOverlay: { position: "absolute", bottom: 8, left: 8, right: 8 },
  verifiedStamp: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.mint, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, alignSelf: "flex-start" },
  stampText: { color: "#fff", fontSize: 8, fontWeight: "900" },
  
  receiptBody: { flex: 1, justifyContent: "center" },
  receiptTitle: { fontSize: 22, fontWeight: "800", color: C.textPrimary, marginBottom: 8 },
  metaGrid: { gap: 6, marginBottom: 16 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaValue: { fontSize: 12, color: C.silver, fontWeight: "500" },
  
  hashBox: { backgroundColor: "rgba(255,255,255,0.03)", padding: 10, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  hashRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  hashLabel: { fontSize: 8, color: C.slate, fontWeight: "800", letterSpacing: 1 },
  hashString: { fontSize: 11, color: C.cyan, fontFamily: "monospace" },
  
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.05)", marginBottom: 24 },
  receiptActions: { gap: 12 },
  secondaryActions: { flexDirection: "row", gap: 12 },
  primaryAction: { width: "100%" },
  
  btnRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  coralBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  cyanBtnText: { color: C.silver, fontSize: 13, fontWeight: "600" },
  builtOn: {
    marginTop: 40, textAlign: "center", fontSize: 10, fontWeight: "600",
    textTransform: "uppercase", letterSpacing: 3, color: "rgba(132,142,160,0.4)",
  },
});