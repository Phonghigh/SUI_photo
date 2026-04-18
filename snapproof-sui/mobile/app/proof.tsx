import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ScrollView,
  Share,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SUI_NETWORK, WALRUS_AGGREGATOR_URL } from "../src/config";

export default function ProofScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    imageHash: string;
    metadataHash: string;
    proofHash: string;
    walrusBlobId: string;
    txDigest: string;
    objectId: string;
    createdAt: string;
    creator: string;
    coarseGeoHash: string;
  }>();

  const formattedDate = params.createdAt
    ? new Date(Number(params.createdAt)).toLocaleString()
    : "Unknown";

  const explorerBase =
    SUI_NETWORK === "mainnet"
      ? "https://suiscan.xyz/mainnet"
      : `https://suiscan.xyz/${SUI_NETWORK}`;

  const txUrl = `${explorerBase}/tx/${params.txDigest}`;
  const objectUrl = params.objectId
    ? `${explorerBase}/object/${params.objectId}`
    : null;
  const walrusUrl = `${WALRUS_AGGREGATOR_URL}/v1/blobs/${params.walrusBlobId}`;

  const openLink = (url: string) => {
    Linking.openURL(url).catch((err) =>
      console.warn("Failed to open URL:", err)
    );
  };

  const shareProof = async () => {
    try {
      await Share.share({
        message: [
          "SnapProof Verification Receipt",
          "",
          `Image Hash: ${params.imageHash}`,
          `Proof Hash: ${params.proofHash}`,
          `Walrus Blob: ${params.walrusBlobId}`,
          `Sui TX: ${txUrl}`,
          `Date: ${formattedDate}`,
          "",
          "Verify at: https://snapproof.app/verify",
        ].join("\n"),
      });
    } catch (error) {
      console.warn("Share failed:", error);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Success badge */}
      <View style={styles.successBadge}>
        <Text style={styles.checkmark}>✓</Text>
        <Text style={styles.successText}>Proof Recorded on Sui</Text>
      </View>

      {/* Proof details card */}
      <View style={styles.card}>
        <Field label="Image Hash" value={params.imageHash} />
        <Field label="Metadata Hash" value={params.metadataHash} />
        <Field label="Proof Hash" value={params.proofHash} />
        <Field label="Walrus Blob ID" value={params.walrusBlobId} />
        <Field label="Transaction Digest" value={params.txDigest} />
        {params.objectId ? (
          <Field label="Object ID" value={params.objectId} />
        ) : null}
        <Field label="Creator" value={params.creator} />
        {params.coarseGeoHash ? (
          <Field label="Location (Geohash)" value={params.coarseGeoHash} />
        ) : null}
        <Field label="Created At" value={formattedDate} mono={false} />
      </View>

      {/* Links */}
      <View style={styles.links}>
        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => openLink(txUrl)}
        >
          <Text style={styles.linkText}>View on Sui Explorer</Text>
        </TouchableOpacity>

        {objectUrl && (
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => openLink(objectUrl)}
          >
            <Text style={styles.linkText}>View Proof Object</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => openLink(walrusUrl)}
        >
          <Text style={styles.linkText}>View Image on Walrus</Text>
        </TouchableOpacity>
      </View>

      {/* Actions */}
      <TouchableOpacity style={styles.shareButton} onPress={shareProof}>
        <Text style={styles.shareButtonText}>Share Proof</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.homeButton}
        onPress={() => router.replace("/")}
      >
        <Text style={styles.homeButtonText}>Back to Home</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  mono = true,
}: {
  label: string;
  value?: string;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <View style={fieldStyles.container}>
      <Text style={fieldStyles.label}>{label}</Text>
      <Text
        style={[fieldStyles.value, mono && fieldStyles.mono]}
        numberOfLines={2}
        selectable
      >
        {value}
      </Text>
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  label: {
    color: "#888",
    fontSize: 11,
    textTransform: "uppercase",
    marginBottom: 3,
    letterSpacing: 0.5,
  },
  value: {
    color: "#fff",
    fontSize: 13,
  },
  mono: {
    fontFamily: "monospace",
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  successBadge: {
    backgroundColor: "#1b4332",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
  },
  checkmark: {
    fontSize: 36,
    color: "#4ecca3",
    marginBottom: 8,
  },
  successText: {
    color: "#4ecca3",
    fontSize: 18,
    fontWeight: "bold",
  },
  card: {
    backgroundColor: "#16213e",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  links: {
    gap: 8,
    marginBottom: 20,
  },
  linkButton: {
    backgroundColor: "#16213e",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#0f3460",
  },
  linkText: {
    color: "#5dade2",
    fontSize: 14,
    textAlign: "center",
    fontWeight: "500",
  },
  shareButton: {
    backgroundColor: "#533483",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  shareButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  homeButton: {
    backgroundColor: "#e94560",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  homeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
