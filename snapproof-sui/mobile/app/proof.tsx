import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Platform,
  Linking,
  Share,
} from "react-native";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import { GlowBackground, GlassCard, CyanButton, CoralButton, PageHeader } from "../src/components/Glass";
import { C, TYPE } from "../src/theme/tokens";
import { FadeUp } from "../src/components/FadeUp";
import { getProofById } from "../src/services/sui";
import { SUI_NETWORK, WALRUS_AGGREGATOR_URLS } from "../src/config";
import type { ProofData } from "../src/types/proof";

export default function ProofDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const [proof, setProof] = useState<ProofData | null>(null);
  const [loading, setLoading] = useState(true);
  const [aggregatorIndex, setAggregatorIndex] = useState(0);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (id) fetchDetail();
  }, [id]);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const data = await getProofById(id!);
      setProof(data);
    } catch (err) {
      console.error("Fetch proof error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!proof) return;
    try {
      await Share.share({
        message: `Check out this tamper-proof photo proof sealed on Sui: ${id}`,
        url: `https://suiscan.xyz/${SUI_NETWORK}/object/${id}`,
      });
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <GlowBackground>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Loading proof...</Text>
        </View>
      </GlowBackground>
    );
  }

  const imageUrl = proof?.walrusBlobId 
    ? `${WALRUS_AGGREGATOR_URLS[aggregatorIndex]}/v1/blobs/${proof.walrusBlobId}`
    : null;

  const handleImageError = () => {
    if (aggregatorIndex < WALRUS_AGGREGATOR_URLS.length - 1) {
      console.log(`[Walrus] Aggregator ${aggregatorIndex} failed, trying next...`);
      setAggregatorIndex(prev => prev + 1);
    } else {
      console.error("[Walrus] All aggregators failed to load blob:", proof?.walrusBlobId);
      setImageError(true);
    }
  };

  return (
    <GlowBackground topColor="rgba(240,86,110,0.22)" bottomColor="rgba(60,200,240,0.28)">
      <Stack.Screen options={{ headerShown: false }} />

      <PageHeader 
        title="Proof Details" 
        rightElement={
          <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
            <Feather name="share-2" size={18} color={C.silver} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: 16 }]}
        showsVerticalScrollIndicator={false}
      >
        
        <FadeUp delay={0}>
          <View style={styles.heroRowContainer}>
            <View style={styles.sealedBadge}>
              <Ionicons name="shield-checkmark" size={12} color={C.mint} style={{ marginRight: 6 }} />
              <Text style={styles.sealedBadgeText}>SEALED ON SUI</Text>
            </View>
            <Text style={styles.heroId}>{id?.slice(0, 8)}…{id?.slice(-4)}</Text>
          </View>
        </FadeUp>

        <FadeUp delay={60}>
          <GlassCard tone="cyan" radius={24} noPad>
            <View style={styles.imageContainer}>
              {imageUrl && !imageError ? (
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.image}
                  onError={handleImageError}
                  accessible={true}
                  accessibilityRole="image"
                  accessibilityLabel={
                    proof?.createdAt
                      ? `Sealed photo, captured on ${new Date(proof.createdAt).toLocaleString()}`
                      : "Sealed photo preview"
                  }
                />
              ) : (
                <View style={styles.placeholder}>
                  <Feather name="image" size={32} color={C.slate} />
                  <Text style={styles.placeholderText}>No image preview</Text>
                </View>
              )}
            </View>
          </GlassCard>
        </FadeUp>

        <FadeUp delay={120}>
          <View style={styles.metaGrid}>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>TIMESTAMP</Text>
              <Text style={styles.metaValue}>
                {proof?.createdAt ? new Date(proof.createdAt).toLocaleString() : "Unknown"}
              </Text>
            </View>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>NETWORK</Text>
              <Text style={styles.metaValue}>{SUI_NETWORK.toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.hashCard}>
            <Text style={styles.metaLabel}>IMAGE HASH (SHA-256)</Text>
            <Text style={styles.hashText}>{proof?.proofHash || "Unknown"}</Text>
          </View>

          {proof?.coarseGeoHash && (
            <View style={styles.locCard}>
              <Text style={styles.metaLabel}>COARSE LOCATION</Text>
              <View style={styles.locRow}>
                <Feather name="map-pin" size={16} color={C.cyan} style={{ marginRight: 8 }} />
                <Text style={styles.metaValue}>{proof.coarseGeoHash}</Text>
              </View>
            </View>
          )}
        </FadeUp>

        <FadeUp delay={180}>
          <CoralButton
            onPress={() => Linking.openURL(`https://suiscan.xyz/${SUI_NETWORK}/object/${id}`)}
            style={styles.explorerBtn}
          >
            <View style={styles.btnRow}>
              <Feather name="external-link" size={18} color="#fff" style={{ marginRight: 10 }} />
              <Text style={styles.coralBtnText}>View on Explorer</Text>
            </View>
          </CoralButton>
          
          <CyanButton onPress={() => router.push("/map")} style={{ marginTop: 12 }}>
            <View style={styles.btnRow}>
              <Feather name="map-pin" size={16} color={C.silver} style={{ marginRight: 8 }} />
              <Text style={styles.cyanBtnText}>See on Proof Map</Text>
            </View>
          </CyanButton>
        </FadeUp>

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
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { color: C.slate, fontSize: 16 },
  backBtn: {
    // Deleted - replaced by PageHeader
  },
  shareBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroRowContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
    marginTop: 8,
  },
  sealedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(64,224,163,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 100,
  },
  sealedBadgeText: { color: C.mint, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  heroId: { fontSize: 12, color: C.slate, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  imageContainer: { aspectRatio: 1, borderRadius: 24, overflow: "hidden", backgroundColor: "#050813" },
  image: { width: "100%", height: "100%" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  placeholderText: { color: C.slate, fontSize: 14, marginTop: 12 },
  metaGrid: { flexDirection: "row", gap: 12, marginTop: 24 },
  metaCell: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 18,
    padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)",
  },
  metaLabel: { ...TYPE.eyebrow, fontSize: 10, marginBottom: 6 },
  metaValue: { fontSize: 15, fontWeight: "700", color: C.textPrimary },
  hashCard: {
    backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 18,
    padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)", marginTop: 12,
  },
  hashText: { fontSize: 12, fontFamily: "monospace", color: C.silver, lineHeight: 18 },
  locCard: {
    backgroundColor: "rgba(60,200,240,0.05)", borderRadius: 18,
    padding: 16, borderWidth: 1, borderColor: "rgba(60,200,240,0.15)", marginTop: 12,
  },
  locRow: { flexDirection: "row", alignItems: "center" },
  btnRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  explorerBtn: { marginTop: 24 },
  coralBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  cyanBtnText: { color: C.silver, fontSize: 14, fontWeight: "600" },
  builtOn: {
    marginTop: 40, textAlign: "center", fontSize: 10, fontWeight: "600",
    textTransform: "uppercase", letterSpacing: 3, color: "rgba(132,142,160,0.4)",
  },
});
