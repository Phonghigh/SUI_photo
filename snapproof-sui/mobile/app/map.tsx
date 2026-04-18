import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Linking,
  Platform,
  Dimensions,
} from "react-native";
import MapView, { Marker, Callout } from "react-native-maps";
import { PROOF_PACKAGE_ID, SUI_NETWORK } from "../src/config";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { decodeGeohash } from "../src/utils/geohash";

interface ProofPin {
  proofId: string;
  txDigest: string;
  imageHash: string;
  geohash: string;
  lat: number;
  lng: number;
  createdAt: number;
  creator: string;
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
        });
      }

      if (loadMore) {
        setProofs((prev) => [...prev, ...pins]);
      } else {
        setProofs(pins);
        if (pins.length > 0) {
          setRegion(prev => ({
            ...prev,
            latitude: pins[0].lat,
            longitude: pins[0].lng,
          }));
        }
      }

      setCursor(response.nextCursor);
      cursorRef.current = response.nextCursor;
      setHasNextPage(response.hasNextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []); // Remove cursor from dependencies to break the infinite loop

  useEffect(() => {
    fetchGeoProofs();
  }, []); // Only run once on mount

  const openInMaps = (lat: number, lng: number) => {
    const url = Platform.OS === "ios" 
      ? `maps:0,0?q=${lat},${lng}` 
      : `geo:${lat},${lng}?q=${lat},${lng}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`).catch(() => {});
    });
  };

  const openExplorer = (txDigest: string) => {
    Linking.openURL(`${explorerBase}/tx/${txDigest}`).catch(() => {});
  };

  const renderProofItem = ({ item }: { item: ProofPin }) => {
    const date = item.createdAt ? new Date(item.createdAt).toLocaleString() : "Unknown";
    const shortHash = item.imageHash ? `${item.imageHash.slice(0, 12)}...` : "";
    
    return (
      <View style={styles.proofCard}>
        <View style={styles.cardHeader}>
          <View style={styles.pinIcon}><Text style={styles.pinEmoji}>📍</Text></View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.geohashText}>{item.geohash}</Text>
            <Text style={styles.coordsText}>{item.lat.toFixed(4)}, {item.lng.toFixed(4)}</Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardRow}><Text style={styles.cardLabel}>Hash</Text><Text style={styles.cardValue}>{shortHash}</Text></View>
          <View style={styles.cardRow}><Text style={styles.cardLabel}>Date</Text><Text style={styles.cardValue}>{date}</Text></View>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => openInMaps(item.lat, item.lng)}>
            <Text style={styles.actionText}>Maps</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.explorerButton]} onPress={() => openExplorer(item.txDigest)}>
            <Text style={styles.actionText}>Explorer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderFooter = () => {
    if (!hasNextPage) return null;
    return (
      <TouchableOpacity style={styles.loadMoreButton} onPress={() => fetchGeoProofs(true)} disabled={loadingMore}>
        {loadingMore ? <ActivityIndicator color="#fff" /> : <Text style={styles.loadMoreText}>Load More</Text>}
      </TouchableOpacity>
    );
  };

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
            <Text style={[styles.toggleText, viewMode === "map" && styles.toggleTextActive]}>Map</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toggleBtn, viewMode === "list" && styles.toggleActive]} 
            onPress={() => setViewMode("list")}
          >
            <Text style={[styles.toggleText, viewMode === "list" && styles.toggleTextActive]}>List</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => fetchGeoProofs()}>
          <Text style={styles.refreshText}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#e94560" /></View>
      ) : error ? (
        <View style={styles.center}><Text style={styles.errorText}>{error}</Text></View>
      ) : viewMode === "map" ? (
        <View style={styles.mapContainer}>
          {Platform.OS === "web" ? (
            <View style={styles.center}><Text style={styles.webText}>Map View is for Mobile. Use List on Web.</Text></View>
          ) : (
            <MapView style={styles.map} region={region} onRegionChangeComplete={setRegion} theme="dark">
              {proofs.map(p => (
                <Marker key={p.txDigest} coordinate={{ latitude: p.lat, longitude: p.lng }}>
                  <Callout onPress={() => openExplorer(p.txDigest)}>
                    <View style={styles.callout}>
                      <Text style={styles.calloutTitle}>SnapProof</Text>
                      <Text style={styles.calloutHash}>{p.imageHash.slice(0, 16)}...</Text>
                      <Text style={styles.calloutLink}>View on Chain</Text>
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
          keyExtractor={p => p.txDigest}
          ListFooterComponent={renderFooter}
          contentContainerStyle={styles.list}
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
  list: { padding: 12 },
  proofCard: { backgroundColor: "#16213e", borderRadius: 12, padding: 12, marginBottom: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  pinIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#1a1a2e", alignItems: "center", justifyContent: "center", marginRight: 10 },
  pinEmoji: { fontSize: 16 },
  cardHeaderText: { flex: 1 },
  geohashText: { color: "#4ecca3", fontSize: 14, fontWeight: "bold", fontFamily: "monospace" },
  coordsText: { color: "#888", fontSize: 10 },
  cardBody: { borderTopWidth: 1, borderTopColor: "#333", paddingTop: 8, marginBottom: 10 },
  cardRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  cardLabel: { color: "#888", fontSize: 11 },
  cardValue: { color: "#ccc", fontSize: 11, fontFamily: "monospace" },
  cardActions: { flexDirection: "row", gap: 8 },
  actionButton: { flex: 1, backgroundColor: "#0f3460", paddingVertical: 8, borderRadius: 6, alignItems: "center" },
  explorerButton: { backgroundColor: "#1a1a2e", borderWidth: 1, borderColor: "#333" },
  actionText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  loadMoreButton: { padding: 16, alignItems: "center" },
  loadMoreText: { color: "#5dade2", fontWeight: "bold" },
  callout: { padding: 8, minWidth: 120 },
  calloutTitle: { fontWeight: "bold", fontSize: 12, marginBottom: 2 },
  calloutHash: { fontSize: 9, color: "#666", marginBottom: 4 },
  calloutLink: { fontSize: 10, color: "#0f3460", fontWeight: "bold" },
});
