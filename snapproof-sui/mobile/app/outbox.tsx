import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import {
  getOutboxQueue,
  removeOutboxItem,
  processQueue,
  OutboxItem,
} from "../src/services/outbox";
import { GlowBackground, GlassCard, CoralButton, CyanButton, PageHeader } from "../src/components/Glass";
import { C, TYPE } from "../src/theme/tokens";
import { FadeUp } from "../src/components/FadeUp";

export default function OutboxScreen() {
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const [queue, setQueue] = useState<OutboxItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async () => {
    const items = await getOutboxQueue();
    setQueue(items.sort((a, b) => a.createdAt - b.createdAt));
  };

  const handleRetryAll = async () => {
    setIsProcessing(true);
    await processQueue();
    await loadQueue();
    setIsProcessing(false);
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      "Remove Proof",
      "Are you sure you want to remove this pending proof from the outbox?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await removeOutboxItem(id);
            await loadQueue();
          },
        },
      ]
    );
  };

  const renderItem = ({ item, index }: { item: OutboxItem; index: number }) => (
    <FadeUp delay={index * 50}>
      <GlassCard radius={20} style={styles.card} noPad>
        <View style={styles.cardInner}>
          <View style={styles.thumbnailWrap}>
            <Image
              source={{ uri: item.imageUri }}
              style={styles.thumbnail}
              accessible={true}
              accessibilityRole="image"
              accessibilityLabel={`Queued proof thumbnail, status: ${item.status}`}
            />
            {item.status === "failed" && (
              <View style={styles.errorOverlay}>
                <Feather name="alert-circle" size={16} color="#fff" />
              </View>
            )}
          </View>
          
          <View style={styles.details}>
            <Text style={styles.dateText}>
              {new Date(item.createdAt).toLocaleDateString()} · {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            
            <View style={styles.statusRow}>
              <View style={[styles.statusBadge, item.status === "failed" ? styles.bgFailed : styles.bgPending]}>
                <Text style={styles.statusBadgeText}>{item.status.toUpperCase()}</Text>
              </View>
              {item.retryCount > 0 && (
                <Text style={styles.retryText}>
                   <Feather name="rotate-ccw" size={10} color={C.slate} /> {item.retryCount} retries
                </Text>
              )}
            </View>

            <View style={styles.hashRow}>
              <Feather name="hash" size={10} color={C.cyan} style={{ marginRight: 4 }} />
              <Text style={styles.hashText} numberOfLines={1}>{item.liveHash}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDelete(item.id)}
            disabled={isProcessing}
          >
            <Feather name="trash-2" size={18} color="rgba(240,86,110,0.6)" />
          </TouchableOpacity>
        </View>
        {item.lastError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText} numberOfLines={1}>
              {item.lastError}
            </Text>
          </View>
        )}
      </GlassCard>
    </FadeUp>
  );

  return (
    <GlowBackground topColor="rgba(240,86,110,0.15)" bottomColor="rgba(60,200,240,0.2)">
      <Stack.Screen options={{ headerShown: false }} />

      <PageHeader title="Offline Outbox" />

      <View style={[styles.container, { paddingTop: 16 }]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Submission Queue</Text>
          </View>
          
          {queue.length > 0 && (
            <TouchableOpacity
              style={[styles.retryButton, isProcessing && styles.retryButtonDisabled]}
              onPress={handleRetryAll}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <View style={styles.btnRow}>
                  <Feather name="play" size={14} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.retryButtonText}>Retry All</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={queue}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <FadeUp delay={100}>
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Feather name="package" size={40} color={C.slate} />
                </View>
                <Text style={styles.emptyText}>Nothing waiting to send</Text>
                <Text style={styles.emptySubtext}>
                  Proofs captured offline land here and send themselves once you're back online.
                </Text>
                <CoralButton style={{ marginTop: 24, paddingHorizontal: 32 }} onPress={() => router.push("/capture")}>
                  <Text style={styles.retryButtonText}>Capture Now</Text>
                </CoralButton>
              </View>
            </FadeUp>
          }
        />
      </View>
    </GlowBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // paddingTop is applied dynamically from useHeaderHeight() in the component.
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(20,28,52,0.65)", borderWidth: 1, borderColor: C.glassBorder,
    alignItems: "center", justifyContent: "center", marginLeft: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  eyebrow: { ...TYPE.eyebrow, marginBottom: 4 },
  headerTitle: {
    color: C.textPrimary,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  retryButton: {
    backgroundColor: C.coral,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    shadowColor: C.coral,
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  btnRow: { flexDirection: "row", alignItems: "center" },
  retryButtonDisabled: {
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    marginBottom: 16,
  },
  cardInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  thumbnailWrap: {
    width: 64,
    height: 64,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(240,86,110,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  details: {
    flex: 1,
    marginLeft: 16,
  },
  dateText: {
    color: C.textPrimary,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 6,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.5,
  },
  bgPending: {
    backgroundColor: "rgba(60,200,240,0.4)",
  },
  bgFailed: {
    backgroundColor: C.coral,
  },
  retryText: {
    color: C.slate,
    fontSize: 11,
    fontWeight: "600",
  },
  hashRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  hashText: {
    color: C.cyan,
    fontSize: 11,
    fontFamily: "monospace",
    opacity: 0.8,
  },
  deleteButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  errorBox: {
    backgroundColor: "rgba(240,86,110,0.08)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.03)",
  },
  errorText: {
    color: C.coral,
    fontSize: 11,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  emptyIconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.03)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.05)",
    marginBottom: 20,
  },
  emptyText: {
    color: C.textPrimary,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
  },
  emptySubtext: {
    color: C.slate,
    fontSize: 14,
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 20,
  },
});
