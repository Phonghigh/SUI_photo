import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Linking,
  Platform,
  type ViewToken,
} from "react-native";
import MapView, { Marker, Callout } from "react-native-maps";
import { PROOF_PACKAGE_ID, SUI_NETWORK, WEB_VERIFIER_URL } from "../src/config";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { decodeGeohash } from "../src/utils/geohash";
import {
  getProofDetailsCached,
  prefetchProofDetails,
} from "../src/services/proofDetails";
import { track } from "../src/services/analytics";

interface ProofPin {
  proofId: string;
  txDigest: string;
  imageHash: string;
  geohash: string;
  lat: number;
  lng: number;
  createdAt: number;
  creator: string;
  /** Fetched lazily via proofDetails.getProofDetailsCached. */
  imageUrl?: string | null;
  /** Track fetch state so we can render a spinner. */
  imageState?: "idle" | "loading" | "ready" | "error";
}

const explorerBase =
  SUI_NETWORK === "mainnet"
    ? "https://suiscan.xyz/mainnet"
    : `https://suiscan.xyz/${SUI_NETWORK}`;

export default function MapScreen() {
  const [proofs, setProofs] = useState<ProofPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const [cursor, setCursor] = useState<any>(null);
  const cursorRef = useRef<any>(null);
  const [hasNextPage, setHasNextPage] = useState(false);

  const [region, setRegion] = useState({
    latitude: 10.762622,
    longitude: 106.660172,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  // --- data ------------------------------------------------------------

  const fetchGeoProofs = useCallback(async (loadMore = false) => {
    try {
      if (loadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setCursor(null);
      }
      setError("");

      const client = new SuiClient({ url: getFullnodeUrl(SUI_NETWORK) });

      const response = await client.queryEvents({
        query: {
          MoveEventType: `${PROOF_PACKAGE_ID}::snapproof::ProofCreated`,
        },
        limit: 50,
        order: "descending",
        cursor: loadMore ? cursorRef.current : null,
      });

      const pins: ProofPin[] = [];
      for (const event of response.data) {
        const parsed = event.parsedJson as Record<string, unknown>;
        const geohash = String(parsed.coarse_geo_hash ?? "");
        if (!geohash) continue;

        const decoded = decodeGeohash(geohash);
        pins.push({
          proofId: String(parsed.proof_id ?? ""),
          txDigest: event.id.txDigest,
          imageHash: String(parsed.image_hash ?? ""),
          geohash,
          lat: decoded.lat,
          lng: decoded.lng,
          createdAt: Number(parsed.created_at ?? event.timestampMs ?? 0),
          creator: String(parsed.creator ?? ""),
          imageState: "idle",
        });
      }

      if (loadMore) {
        setProofs((prev) => [...prev, ...pins]);
      } else {
        setProofs(pins);
        if (pins.length > 0) {
          setRegion((prev) => ({
            ...prev,
            latitude: pins[0].lat,
            longitude: pins[0].lng,
          }));
        }
      }

      setCursor(response.nextCursor);
      cursorRef.current = response.nextCursor;
      setHasNextPage(response.hasNextPage);

      // Prefetch the first handful of thumbnails so map markers and the
      // top of the list render with images without waiting on a tap.
      const firstN = pins.slice(0, 8).map((p) => p.proofId).filter(Boolean);
      if (firstN.length > 0) {
        prefetchProofDetails(firstN, 6).then((hydrated) => {
          setProofs((prev) =>
            prev.map((p) => {
              const d = hydrated[p.proofId];
              if (!d) return p;
              return {
                ...p,
                imageUrl: d.imageUrl,
                imageState: d.imageUrl ? "ready" : "error",
              };
            })
          );
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchGeoProofs();
  }, [fetchGeoProofs]);

  // Fetch a single pin's image details lazily. Safe to call repeatedly.
  const hydratePin = useCallback(async (proofId: string) => {
    if (!proofId) return;
    setProofs((prev) =>
      prev.map((p) =>
        p.proofId === proofId && p.imageState === "idle"
          ? { ...p, imageState: "loading" }
          : p
      )
    );
    const details = await getProofDetailsCached(proofId);
    setProofs((prev) =>
      prev.map((p) =>
        p.proofId === proofId
          ? {
              ...p,
              imageUrl: details?.imageUrl ?? null,
              imageState: details?.imageUrl ? "ready" : "error",
            }
          : p
      )
    );
  }, []);

  // --- actions ---------------------------------------------------------

  const openInMaps = (lat: number, lng: number) => {
    const url =
      Platform.OS === "ios"
        ? `maps:0,0?q=${lat},${lng}`
        : `geo:${lat},${lng}?q=${lat},${lng}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
      ).catch(() => {});
    });
  };

  const openExplorer = (txDigest: string) => {
    Linking.openURL(`${explorerBase}/tx/${txDigest}`).catch(() => {});
  };

  const openVerifier = (proofId: string) => {
    if (!proofId) return;
    track({ name: "map_proof_opened", props: { proofId } });
    Linking.openURL(`${WEB_VERIFIER_URL}/p/${proofId}`).catch(() => {});
  };

  // Kick off a lazy fetch when list items enter the viewport.
  const onViewableItemsChanged = useRef(
    (info: { viewableItems: ViewToken[] }) => {
      const ids = info.viewableItems
        .map((v) => (v.item as ProofPin)?.proofId)
        .filter(Boolean) as string[];
      if (ids.length > 0) prefetchProofDetails(ids, 4);
    }
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 30 }).current;

  // --- render helpers --------------------------------------------------

  const Thumbnail = ({
    pin,
    size,
    borderRadius,
  }: {
    pin: ProofPin;
    size: number;
    borderRadius: number;
  }) => {
    const dims = { width: size, height: size, borderRadius };

    if (pin.imageState === "loading") {
      return (
        <View style={[styles.thumbPlaceholder, dims]}>
          <ActivityIndicator size="small" color="#5dade2" />
        </View>
      );
    }
    if (pin.imageUrl && pin.imageState === "ready") {
      return (
        <Image
          source={{ uri: pin.imageUrl }}
          style={[styles.thumbImage, dims]}
          onError={() => {
            setProofs((prev) =>
              prev.map((p) =>
                p.proofId === pin.proofId ? { ...p, imageState: "error" } : p
              )
            );
          }}
        />
      );
    }
    // idle or error — show a short hash fingerprint
    const fp = pin.imageHash ? pin.imageHash.slice(0, 4).toUpperCase() : "•••";
    return (
      <View style={[styles.thumbPlaceholder, dims]}>
        <Text style={styles.thumbFallback}>{fp}</Text>
      </View>
    );
  };

  const renderProofItem = ({ item }: { item: ProofPin }) => {
    const date = item.createdAt
      ? new Date(item.createdAt).toLocaleString()
      : "Unknown";
    const shortHash = item.imageHash ? `${item.imageHash.slice(0, 12)}...` : "";

    return (
      <View style={styles.proofCard}>
        <View style={styles.cardHeader}>
          <Thumbnail pin={item} size={64} borderRadius={10} />
          <View style={styles.cardHeaderText}>
            <Text style={styles.geohashText}>{item.geohash}</Text>
            <Text style={styles.coordsText}>
              {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
            </Text>
            <Text style={styles.cardDate}>{date}</Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Hash</Text>
            <Text style={styles.cardValue}>{shortHash}</Text>
          </View>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => openInMaps(item.lat, item.lng)}
          >
            <Text style={styles.actionText}>Maps</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.explorerButton]}
            onPress={() => openExplorer(item.txDigest)}
          >
            <Text style={styles.actionText}>Explorer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.verifierButton]}
            onPress={() => openVerifier(item.proofId)}
          >
            <Text style={styles.actionText}>Verify</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderFooter = () => {
    if (!hasNextPage) return null;
    return (
      <TouchableOpacity
        style={styles.loadMoreButton}
        onPress={() => fetchGeoProofs(true)}
        disabled={loadingMore}
      >
        {loadingMore ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.loadMoreText}>Load More</Text>
        )}
      </TouchableOpacity>
    );
  };

  // --- screen ---------------------------------------------------------

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.statContainer}>
          <Text style={styles.statCount}>{proofs.length}</Text>
          <Text style={styles.statLabel}>Proofs</Text>
        </View>
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === "map" && styles.toggleActive]}
            onPress={() => setViewMode("map")}
          >
            <Text
              style={[
                styles.toggleText,
                viewMode === "map" && styles.toggleTextActive,
              ]}
            >
              Map
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === "list" && styles.toggleActive]}
            onPress={() => setViewMode("list")}
          >
            <Text
              style={[
                styles.toggleText,
                viewMode === "list" && styles.toggleTextActive,
              ]}
            >
              List
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => fetchGeoProofs()}>
          <Text style={styles.refreshText}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#e94560" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : viewMode === "map" ? (
        <View style={styles.mapContainer}>
          {Platform.OS === "web" ? (
            <View style={styles.center}>
              <Text style={styles.webText}>
                Map View is for Mobile. Use List on Web.
              </Text>
            </View>
          ) : (
            <MapView
              style={styles.map}
              region={region}
              onRegionChangeComplete={setRegion}
              theme="dark"
            >
              {proofs.map((p) => (
                <Marker
                  key={p.txDigest}
                  coordinate={{ latitude: p.lat, longitude: p.lng }}
                  onPress={() => {
                    if (p.imageState === "idle") hydratePin(p.proofId);
                  }}
                >
                  {/* Custom marker avatar: Walrus thumbnail with colored ring. */}
                  <View style={styles.markerRing}>
                    <Thumbnail pin={p} size={40} borderRadius={20} />
                  </View>

                  <Callout
                    tooltip
                    onPress={() => openVerifier(p.proofId)}
                  >
                    <View style={styles.callout}>
                      <View style={styles.calloutImageWrap}>
                        <Thumbnail pin={p} size={160} borderRadius={8} />
                      </View>
                      <Text style={styles.calloutTitle}>SnapProof</Text>
                      <Text style={styles.calloutHash}>
                        {p.imageHash.slice(0, 16)}...
                      </Text>
                      <Text style={styles.calloutLink}>Open Verifier →</Text>
                    </View>
                  </Callout>
                </Marker>
              ))}
            </MapView>
          )}
        </View>
      ) : (
        <FlatList
          data={proofs}
          renderItem={renderProofItem}
          keyExtractor={(p) => p.txDigest}
          ListFooterComponent={renderFooter}
          contentContainerStyle={styles.list}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a1a2e" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#16213e",
    borderBottomWidth: 1,
    borderBottomColor: "#0f3460",
  },
  statContainer: { marginRight: 16 },
  statCount: { color: "#4ecca3", fontSize: 18, fontWeight: "bold" },
  statLabel: { color: "#888", fontSize: 10, textTransform: "uppercase" },
  toggleContainer: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#0f3460",
    borderRadius: 8,
    padding: 2,
  },
  toggleBtn: { flex: 1, paddingVertical: 6, alignItems: "center", borderRadius: 6 },
  toggleActive: { backgroundColor: "#1a1a2e" },
  toggleText: { color: "#888", fontSize: 12, fontWeight: "bold" },
  toggleTextActive: { color: "#fff" },
  refreshBtn: { marginLeft: 12, padding: 8 },
  refreshText: { color: "#5dade2", fontSize: 20 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  errorText: { color: "#ff6b6b", textAlign: "center" },
  webText: { color: "#888", textAlign: "center" },

  mapContainer: { flex: 1 },
  map: { width: "100%", height: "100%" },

  // List card
  list: { padding: 12 },
  proofCard: {
    backgroundColor: "#16213e",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  cardHeaderText: { flex: 1, marginLeft: 12 },
  geohashText: {
    color: "#4ecca3",
    fontSize: 14,
    fontWeight: "bold",
    fontFamily: "monospace",
  },
  coordsText: { color: "#888", fontSize: 10 },
  cardDate: { color: "#ccc", fontSize: 11, marginTop: 4 },
  cardBody: {
    borderTopWidth: 1,
    borderTopColor: "#333",
    paddingTop: 8,
    marginBottom: 10,
  },
  cardRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  cardLabel: { color: "#888", fontSize: 11 },
  cardValue: { color: "#ccc", fontSize: 11, fontFamily: "monospace" },
  cardActions: { flexDirection: "row", gap: 8 },
  actionButton: {
    flex: 1,
    backgroundColor: "#0f3460",
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  explorerButton: {
    backgroundColor: "#1a1a2e",
    borderWidth: 1,
    borderColor: "#333",
  },
  verifierButton: {
    backgroundColor: "#e94560",
  },
  actionText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  loadMoreButton: { padding: 16, alignItems: "center" },
  loadMoreText: { color: "#5dade2", fontWeight: "bold" },

  // Marker
  markerRing: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#e94560",
    padding: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
    alignItems: "center",
    justifyContent: "center",
  },

  // Thumbnail fallback states
  thumbImage: { backgroundColor: "#0a0a12" },
  thumbPlaceholder: {
    backgroundColor: "#0f3460",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbFallback: {
    color: "#5dade2",
    fontFamily: "monospace",
    fontSize: 11,
    fontWeight: "700",
  },

  // Callout — `tooltip` mode means we own the whole bubble.
  callout: {
    backgroundColor: "#16213e",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#0f3460",
    padding: 10,
    minWidth: 180,
    maxWidth: 220,
  },
  calloutImageWrap: { marginBottom: 8, alignItems: "center" },
  calloutTitle: {
    fontWeight: "700",
    fontSize: 13,
    marginBottom: 2,
    color: "#fff",
  },
  calloutHash: {
    fontSize: 10,
    fontFamily: "monospace",
    color: "#888",
    marginBottom: 6,
  },
  calloutLink: { fontSize: 12, color: "#5dade2", fontWeight: "700" },
});
