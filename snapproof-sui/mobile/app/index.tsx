import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
  Animated,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import {
  GlassCard,
  GlowBackground,
  CoralButton,
  CyanButton,
  StatusPill,
} from "../src/components/Glass";
import { C, TYPE } from "../src/theme/tokens";
import { SnapLogo } from "../src/components/SnapLogo";
import { FadeUp } from "../src/components/FadeUp";
import { getAddress } from "../src/services/wallet";
import { getBalance, getProofs } from "../src/services/sui";
import { SUI_NETWORK } from "../src/config";
import { LinearGradient } from "expo-linear-gradient";

export default function HomeScreen() {
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  const [walletAddress, setWalletAddress] = useState("");
  const [balance, setBalance] = useState<string>("");
  const [stats, setStats] = useState({ total: 0, week: 0, lastSeal: "" });
  const [copied, setCopied] = useState(false);

  const initWallet = async () => {
    try {
      const addr = await getAddress();
      setWalletAddress(addr);
      await refreshData(addr);
    } catch (err) {
      console.warn("Home init error:", err);
    }
  };

  const refreshData = async (addr: string) => {
    const [bal, allProofs] = await Promise.all([
      getBalance(),
      getProofs(100)
    ]);
    
    setBalance((Number(bal) / 1_000_000_000).toFixed(3));
    
    // Normalized comparison for Sui addresses
    const normalizedAddr = addr.toLowerCase().replace(/^0x/, "");
    const myProofs = allProofs.filter(p => {
      if (!p.creator) return false;
      const creatorClean = p.creator.toLowerCase().replace(/^0x/, "");
      return creatorClean === normalizedAddr;
    });

    
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const weekCount = myProofs.filter(p => (p.createdAt || 0) > weekAgo).length;
    
    let lastSealStr = "No seals yet";
    if (myProofs.length > 0) {
      const last = myProofs[0].createdAt || 0;
      const diffMin = Math.floor((now - last) / 60000);
      lastSealStr = diffMin < 60 ? `${diffMin}m ago` : diffMin < 1440 ? `${Math.floor(diffMin/60)}h ago` : `${Math.floor(diffMin/1440)}d ago`;
    }
    
    setStats({
      total: myProofs.length,
      week: weekCount,
      lastSeal: lastSealStr
    });
  };

  const handleCopy = async () => {
    if (walletAddress) {
      await Clipboard.setStringAsync(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  useFocusEffect(
    useCallback(() => {
      initWallet();
    }, [])
  );


  const networkLabel =
    SUI_NETWORK.charAt(0).toUpperCase() + SUI_NETWORK.slice(1);
  const truncated = walletAddress
    ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
    : "Connecting…";

  return (
    <GlowBackground
      topColor="rgba(240,86,110,0.35)"
      bottomColor="rgba(60,200,240,0.28)"
    >
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: headerHeight + 32, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Header */}
        <FadeUp delay={0}>
          <View style={styles.header}>
            <SnapLogo />
            <StatusPill status={networkLabel} />
          </View>
        </FadeUp>

        {/* 2. Hero Section */}
        <FadeUp delay={60}>
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>Proof of Capture</Text>
            <Text style={styles.heroTitle}>
              Every photo,{"\n"}
              <Text style={{ color: C.silver }}>sealed on-chain.</Text>
            </Text>
            <Text style={styles.heroSub}>
              Tamper-proof receipts in one tap.
            </Text>
          </View>
        </FadeUp>

        {/* 3. Identity Card (Wallet) */}
        <FadeUp delay={120}>
          <GlassCard style={styles.walletCard} radius={28} tone="cyan">
            <View style={styles.walletInner}>
              <View style={styles.walletHeader}>
                <View style={styles.avatarContainer}>
                  <LinearGradient
                    colors={[C.cyan, C.purple]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.avatarGlow}
                  >
                    <View style={styles.avatarInner}>
                      <Ionicons name="finger-print" size={24} color="#fff" />
                    </View>
                  </LinearGradient>
                  <View style={styles.onlineStatus} />
                </View>

                <View style={styles.identityInfo}>
                  <Text style={styles.identityLabel}>OPERATOR ID</Text>
                  <View style={styles.addrRow}>
                    <Text style={styles.walletAddr}>{truncated}</Text>
                    <TouchableOpacity
                      onPress={handleCopy}
                      style={styles.copyBadge}
                      activeOpacity={0.7}
                    >
                      <Feather name={copied ? "check" : "copy"} size={12} color={copied ? C.mint : C.cyan} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>SEALED PROOFS</Text>
                  <View style={styles.statValueRow}>
                    <Text style={styles.statValue}>{stats.total}</Text>
                    <View style={styles.trendingUp}>
                      <Feather name="arrow-up-right" size={12} color={C.mint} />
                    </View>
                  </View>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>NETWORK HEALTH</Text>
                  <View style={styles.statValueRow}>
                    <Text style={[styles.statValue, { color: C.mint }]}>ACTIVE</Text>
                    <View style={styles.pulseContainer}>
                      <View style={styles.pulseDot} />
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.walletFooter}>
                <View style={styles.footerInfo}>
                  <Feather name="database" size={12} color={C.slate} style={{ marginRight: 6 }} />
                  <Text style={styles.footerText}>
                    Walrus Storage <Text style={{ color: C.silver }}>· Synchronized</Text>
                  </Text>
                </View>

                <View style={styles.balanceTag}>
                  <Text style={styles.balanceLabel}>BAL</Text>
                  <Text style={styles.balanceAmount}>{balance || "0.000"} SUI</Text>
                </View>
              </View>
            </View>
          </GlassCard>
        </FadeUp>

        {/* 4. Primary CTA */}
        <FadeUp delay={180}>
          <CoralButton
            onPress={() => router.push("/capture")}
            style={styles.primaryBtn}
          >
            <View style={styles.btnInner}>
              <Feather name="camera" size={18} color="#fff" style={styles.btnIcon} />
              <Text style={styles.coralBtnText}>Capture Photo</Text>
            </View>
          </CoralButton>
        </FadeUp>

        {/* 5. Secondary CTA */}
        <FadeUp delay={220}>
          <CyanButton
            onPress={() => router.push("/verify")}
            style={styles.secondaryBtn}
          >
            <View style={styles.btnInner}>
              <Feather name="shield" size={18} color={C.silver} style={styles.btnIcon} />
              <Text style={styles.cyanBtnText}>Verify Photo</Text>
            </View>
          </CyanButton>
        </FadeUp>

        {/* 6. Tertiary CTA */}
        <FadeUp delay={260}>
          <TouchableOpacity
            onPress={() => router.push("/map")}
            style={styles.tertiaryBtn}
            activeOpacity={0.7}
          >
            <View style={styles.btnInner}>
              <Feather name="map-pin" size={14} color={C.slate} style={styles.btnIconSmall} />
              <Text style={styles.tertiaryText}>Proof Map  →</Text>
            </View>
          </TouchableOpacity>
        </FadeUp>

      </ScrollView>
    </GlowBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    // paddingTop + paddingBottom are applied dynamically from safe-area insets
    // in the component above; keeping defaults here as safe fallbacks.
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 48,
  },
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
  },
  statusDotWrap: {
    width: 8,
    height: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  statusDotPulse: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.mint,
    opacity: 0.4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.mint,
  },
  statusText: {
    color: C.silver,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  hero: {
    marginBottom: 32,
  },
  eyebrow: {
    ...TYPE.eyebrow,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 42,
    fontWeight: "800",
    letterSpacing: -1.5,
    color: C.textPrimary,
    lineHeight: 48,
    marginBottom: 16,
  },
  heroSub: {
    fontSize: 15,
    color: C.silver,
    lineHeight: 24,
    opacity: 0.9,
  },
  walletCard: {
    marginBottom: 24,
  },
  walletInner: {
    gap: 16,
    padding: 20,
  },
  walletHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatarContainer: {
    position: "relative",
  },
  avatarGlow: {
    width: 52,
    height: 52,
    borderRadius: 26,
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInner: {
    width: "100%",
    height: "100%",
    borderRadius: 24,
    backgroundColor: "rgba(10,15,30,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  onlineStatus: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: C.mint,
    borderWidth: 2,
    borderColor: "#050813",
  },
  identityInfo: {
    flex: 1,
  },
  identityLabel: {
    ...TYPE.eyebrow,
    fontSize: 10,
    marginBottom: 6,
    color: C.cyan,
  },
  addrRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  walletAddr: {
    fontSize: 16,
    fontWeight: "700",
    color: C.textPrimary,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  copyBadge: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statBox: {
    flex: 1,
  },
  statLabel: {
    ...TYPE.eyebrow,
    fontSize: 10,
    marginBottom: 6,
    color: C.silver,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
    color: C.textPrimary,
    letterSpacing: -0.5,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginHorizontal: 20,
  },
  statValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  trendingUp: {
    padding: 2,
    borderRadius: 4,
    backgroundColor: "rgba(64,224,163,0.1)",
  },
  pulseContainer: {
    width: 10,
    height: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.mint,
    shadowColor: C.mint,
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  walletFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.02)",
    padding: 12,
    borderRadius: 16,
  },
  footerInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  footerText: {
    fontSize: 11,
    color: C.silver, // Brighter for better visibility
  },
  balanceTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(60,200,240,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    minWidth: 85,
    justifyContent: "center",
  },
  balanceLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: C.cyan,
  },
  balanceAmount: {
    fontSize: 12,
    fontWeight: "800",
    color: "#fff",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  primaryBtn: {
    marginBottom: 12,
  },
  coralBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  secondaryBtn: {
    marginBottom: 16,
  },
  cyanBtnText: {
    color: C.silver,
    fontSize: 14,
    fontWeight: "600",
  },
  tertiaryBtn: {
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tertiaryText: {
    fontSize: 13,
    fontWeight: "500",
    color: C.slate,
    letterSpacing: 0.2,
  },
  btnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  btnIcon: {
    marginRight: 10,
  },
  btnIconSmall: {
    marginRight: 6,
  },
  builtOn: {
    marginTop: 40,
    textAlign: "center",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 3,
    color: "rgba(132,142,160,0.4)",
  },
});
