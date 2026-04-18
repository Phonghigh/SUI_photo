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
import { Stack } from "expo-router";
import * as Clipboard from "expo-clipboard";
import {
  getOutboxQueue,
  removeOutboxItem,
  processQueue,
  OutboxItem,
} from "../src/services/outbox";

function showAlert(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function OutboxScreen() {
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
    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to delete this pending proof?")) {
        await removeOutboxItem(id);
        await loadQueue();
      }
    } else {
      Alert.alert(
        "Delete Proof",
        "Are you sure you want to delete this pending proof?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              await removeOutboxItem(id);
              await loadQueue();
            },
          },
        ]
      );
    }
  };

  const handleCopyHash = async (hash: string) => {
    await Clipboard.setStringAsync(hash);
    if (Platform.OS === "web") {
      window.alert("Hash copied to clipboard");
    }
  };

  const renderItem = ({ item }: { item: OutboxItem }) => (
    <View style={styles.card}>
      <Image source={{ uri: item.imageUri }} style={styles.thumbnail} />
      <View style={styles.details}>
        <Text style={styles.dateText}>
          {new Date(item.createdAt).toLocaleString()}
        </Text>
        <TouchableOpacity onPress={() => handleCopyHash(item.liveHash)}>
          <Text style={styles.hashText} numberOfLines={1} ellipsizeMode="middle">
            Hash: {item.liveHash}
          </Text>
        </TouchableOpacity>

        <View style={styles.statusRow}>
          <Text
            style={[
              styles.statusBadge,
              item.status === "failed" ? styles.bgFailed : styles.bgPending,
            ]}
          >
            {item.status.toUpperCase()}
          </Text>
          {item.retryCount > 0 && (
            <Text style={styles.retryText}>Retries: {item.retryCount}</Text>
          )}
        </View>

        {item.lastError && (
          <Text style={styles.errorText} numberOfLines={2}>
            {item.lastError}
          </Text>
        )}
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDelete(item.id)}
        disabled={isProcessing}
      >
        <Text style={styles.deleteText}>✕</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Offline Outbox" }} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {queue.length} Pending Submission{queue.length !== 1 ? "s" : ""}
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, isProcessing && styles.retryButtonDisabled]}
          onPress={handleRetryAll}
          disabled={isProcessing || queue.length === 0}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.retryButtonText}>Retry All</Text>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={queue}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📦</Text>
            <Text style={styles.emptyText}>Your outbox is empty.</Text>
            <Text style={styles.emptySubtext}>
              Photos captured without internet will appear here.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#16213e",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  retryButton: {
    backgroundColor: "#e94560",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonDisabled: {
    backgroundColor: "#555",
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: "#16213e",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: "#0f3460",
  },
  details: {
    flex: 1,
    marginLeft: 12,
  },
  dateText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  hashText: {
    color: "#5dade2",
    fontSize: 12,
    fontFamily: "monospace",
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusBadge: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#fff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  bgPending: {
    backgroundColor: "#f39c12",
  },
  bgFailed: {
    backgroundColor: "#c0392b",
  },
  retryText: {
    color: "#888",
    fontSize: 12,
  },
  errorText: {
    color: "#ff6b6b",
    fontSize: 11,
    marginTop: 8,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  deleteText: {
    color: "#888",
    fontSize: 18,
    fontWeight: "bold",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  emptySubtext: {
    color: "#888",
    fontSize: 14,
    textAlign: "center",
    maxWidth: 250,
  },
});
