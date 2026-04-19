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
import { Stack, Link } from "expo-router";
import { useFocusEffect } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { GlassCard, GlowBackground } from "../src/components/Glass";
import { C, TYPE } from "../src/theme/tokens";
import { WorldMap, type Proof } from "../src/components/WorldMap";
import { FadeUp } from "../src/components/FadeUp";
import { getProofs } from "../src/services/sui";
import { decodeGeohash } from "../src/utils/geohash";
import { track } from "../src/services/analytics";

const FILTERS = ["All", "Verified", "Mine", "24h"] as const;

export default function MapScreen() {
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]>("All");
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [selected, setSelected] = useState<Proof | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchGeoProofs = async () => {
    try {
      setLoading(true);
      const all = await getProofs();
      const mapped: Proof[] = all
        .filter((p) => p.coarseGeoHash)
        .map((p) => {
          const decoded = decodeGeohash(p.coarseGeoHash!);
          const latitude = decoded.lat;
          const longitude = decoded.lng;
          
          if (isNaN(latitude) || isNaN(longitude)) return null;

          const proof: Proof = {
            id: p.proofHash.slice(0, 10),
            latitude,
            longitude,
            location: p.coarseGeoHash || "Unknown",
            time: p.createdAt ? new Date(p.createdAt).toLocaleTimeString() : "Unknown",
            verified: true,
            hot: Date.now() - (p.createdAt || 0) < 3600000,
          };
          return proof;
        })
        .filter((p): p is Proof => p !== null);
      setProofs(mapped);
      if (mapped.length > 0) setSelected(mapped[0]);
    } catch (error) {
      console.warn("Map fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      track({ name: "map_viewed" });
      fetchGeoProofs();
    }, [])
  );

  return (
    <GlowBackground
      topColor="rgba(60,200,240,0.28)"
      bottomColor="rgba(240,86,110,0.22)"
    >
      <Stack.Screen
        options={{
          headerTransparent: true,
          headerTitle: "",
          headerLeft: () => (
            <Link href="/" asChild>
              <TouchableOpacity style={styles.backBtn}>
                <Feather name="arrow-left" size={20} color={C.silver} />
              </TouchableOpacity>
            </Link>
          ),
          headerRight: () => (
            <View style={styles.statusChip}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Live</Text>
            </View>
          ),
        }}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Hero Stats */}
        <FadeUp delay={60}>
          <View style={styles.hero}>
            <View style={styles.heroEyebrow}>
              <Feather name="globe" size={14} color={C.cyan} style={{ marginRight: 6 }} />
              <Text style={styles.eyebrow}>Live network</Text>
            </View>
            <Text style={styles.heroTitle}>
              <Text style={{ color: C.coral }}>{proofs.length}</Text> proofs sealed{"\n"}
              <Text style={{ color: C.silver }}>across the globe.</Text>
            </Text>
          </View>
        </FadeUp>

        {/* 2. Map View */}
        <FadeUp delay={120}>
          <GlassCard tone="cyan" style={styles.mapCard} radius={24} noPad>
            <View style={styles.mapInner}>
              <WorldMap
                proofs={proofs}
                selectedId={selected?.id}
                onSelect={setSelected}
              />
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: C.mint }]} />
                  <Text style={styles.legendText}>Verified</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: C.coral }]} />
                  <Text style={styles.legendText}>Recent</Text>
                </View>
                <Text style={styles.epochText}>EPOCH 412</Text>
              </View>
            </View>
          </GlassCard>
        </FadeUp>

        {/* 3. Filter Chips */}
        <FadeUp delay={180}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {FILTERS.map((f) => (
              <TouchableOpacity
                key={f}
                onPress={() => setActiveFilter(f)}
                style={[
                  styles.filterBtn,
                  activeFilter === f && styles.filterBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterBtnText,
                    activeFilter === f && styles.filterBtnTextActive,
                  ]}
                >
                  {f}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </FadeUp>

        {/* 4. Recent Proofs List */}
        <FadeUp delay={220}>
          <View style={styles.listHeader}>
            <Text style={styles.eyebrow}>Recent proofs</Text>
            <Text style={styles.listCount}>{proofs.length} shown</Text>
          </View>
          <GlassCard radius={24} noPad>
            <View style={styles.listInner}>
              {proofs.slice(0, 5).map((p, i) => (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => setSelected(p)}
                  style={[
                    styles.listItem,
                    selected?.id === p.id && styles.listItemActive,
                    i === 0 && { borderTopWidth: 0 },
                  ]}
                >
                  <View
                    style={[
                      styles.itemIconWrap,
                      { backgroundColor: p.verified ? "rgba(64,224,163,0.1)" : "rgba(240,86,110,0.1)" },
                    ]}
                  >
                    <Feather name="map-pin" size={18} color={p.verified ? C.mint : C.coral} />
                    {p.hot && <View style={styles.hotIndicator} />}
                  </View>
                  <View style={styles.itemInfo}>
                    <View style={styles.itemTitleRow}>
                      <Text style={styles.itemLocation} numberOfLines={1}>
                        {p.location}
                      </Text>
                      <Text style={styles.itemId}>{p.id}</Text>
                    </View>
                    <View style={styles.itemMetaRow}>
                      <Feather name="clock" size={10} color={C.slate} />
                      <Text style={styles.itemMetaText}>{p.time}</Text>
                      <Text style={styles.metaDot}>·</Text>
                      <Text
                        style={[
                          styles.itemStatus,
                          { color: p.verified ? C.mint : C.coral },
                        ]}
                      >
                        {p.verified ? "Verified" : "Pending"}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </GlassCard>
        </FadeUp>

        {/* 5. Selected Detail */}
        {selected && (
          <FadeUp delay={260} style={{ marginTop: 20 }}>
            <GlassCard tone="cyan" radius={24}>
              <View style={styles.detailInner}>
                <View style={styles.detailHeader}>
                  <Text style={styles.eyebrow}>Selected</Text>
                  <View style={styles.detailBadge}>
                    <View style={[styles.statusDot, { backgroundColor: C.mint }]} />
                    <Text style={styles.detailBadgeText}>Sealed</Text>
                  </View>
                </View>
                <View style={styles.detailMain}>
                  <Text style={styles.detailLocation} numberOfLines={1}>
                    {selected.location}
                  </Text>
                  <Text style={styles.detailId}>{selected.id}</Text>
                </View>
                <Text style={styles.detailSub}>
                  Captured {selected.time} · Sui Mainnet
                </Text>
                <TouchableOpacity style={styles.explorerBtn}>
                  <Text style={styles.explorerBtnText}>View on explorer ↗</Text>
                </TouchableOpacity>
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
  container: {
    flex: 1,
  },
  content: {
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
  backIcon: {
    color: C.silver,
    fontSize: 20,
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
    marginRight: 16,
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
  },
  hero: {
    marginBottom: 24,
  },
  heroEyebrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  eyebrowIcon: {
    fontSize: 14,
  },
  eyebrow: {
    ...TYPE.eyebrow,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -1,
    color: C.textPrimary,
    lineHeight: 38,
  },
  mapCard: {
    marginBottom: 24,
  },
  mapInner: {
    padding: 12,
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingHorizontal: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginRight: 12,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 10,
    color: C.slate,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  epochText: {
    fontSize: 10,
    fontFamily: "monospace",
    color: C.slate,
  },
  filterRow: {
    paddingBottom: 20,
    gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  filterBtnActive: {
    backgroundColor: C.textPrimary,
    borderColor: C.textPrimary,
  },
  filterBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: C.slate,
  },
  filterBtnTextActive: {
    color: "#050813",
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  listCount: {
    fontSize: 10,
    fontFamily: "monospace",
    color: C.slate,
  },
  listInner: {
    overflow: "hidden",
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  listItemActive: {
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  itemIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  hotIndicator: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.coral,
    borderWidth: 1,
    borderColor: "#050813",
  },
  itemInfo: {
    flex: 1,
  },
  itemTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  itemLocation: {
    fontSize: 14,
    fontWeight: "700",
    color: C.textPrimary,
    flex: 1,
  },
  itemId: {
    fontSize: 11,
    fontFamily: "monospace",
    color: C.slate,
    marginLeft: 8,
  },
  itemMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  itemMetaText: {
    fontSize: 11,
    color: C.slate,
  },
  metaDot: {
    color: C.slate,
    fontSize: 11,
  },
  itemStatus: {
    fontSize: 11,
    fontWeight: "600",
  },
  detailInner: {
    padding: 20,
  },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  detailBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    backgroundColor: "rgba(64,224,163,0.12)",
  },
  detailBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: C.mint,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  detailMain: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 4,
  },
  detailLocation: {
    fontSize: 18,
    fontWeight: "700",
    color: C.textPrimary,
    flex: 1,
  },
  detailId: {
    fontSize: 12,
    fontFamily: "monospace",
    color: C.silver,
    marginLeft: 12,
  },
  detailSub: {
    fontSize: 12,
    color: C.slate,
    marginBottom: 16,
  },
  explorerBtn: {
    width: "100%",
    paddingVertical: 12,
    borderRadius: 100,
    backgroundColor: "rgba(60,200,240,0.08)",
    borderWidth: 1,
    borderColor: C.cyanBorder,
    alignItems: "center",
  },
  explorerBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.cyan,
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
