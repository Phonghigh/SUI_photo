import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Platform,
  TextInput,
  ScrollView,
  Linking,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { hashImage } from "../src/utils/hash";
import { lookupProofByImageHash, getProofById } from "../src/services/sui";
import { SUI_NETWORK, WALRUS_AGGREGATOR_URL } from "../src/config";
import { track, captureException } from "../src/services/analytics";
import type { ProofData } from "../src/types/proof";

function showAlert(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    const { Alert } = require("react-native");
    Alert.alert(title, message);
  }
}

export default function VerifyScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [mode, setMode] = useState<"image" | "hash">("image");
  const [expectedHash, setExpectedHash] = useState("");
  const [result, setResult] = useState<
    "match" | "mismatch" | "not_found" | null
  >(null);
  const [computedHash, setComputedHash] = useState("");
  const [foundProof, setFoundProof] = useState<ProofData | null>(null);
  const [foundTxDigest, setFoundTxDigest] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const explorerBase =
    SUI_NETWORK === "mainnet"
      ? "https://suiscan.xyz/mainnet"
      : `https://suiscan.xyz/${SUI_NETWORK}`;

  const pickImage = async () => {
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!pickerResult.canceled && pickerResult.assets[0]) {
      setImageUri(pickerResult.assets[0].uri);
      setResult(null);
      setFoundProof(null);
      setErrorMsg("");
    }
  };

  const verifyByImage = async () => {
    if (!imageUri) {
      showAlert("No image", "Select an image to verify.");
      return;
    }

    const startedAt = Date.now();
    track({ name: "verify_started", props: { mode: "image" } });

    try {
      setLoading(true);
      setResult(null);
      setFoundProof(null);
      setErrorMsg("");

      setStatusText("Computing image hash...");
      const hash = await hashImage(imageUri);
      setComputedHash(hash);

      setStatusText("Searching Sui blockchain...");
      const lookup = await lookupProofByImageHash(hash);

      if (lookup) {
        setStatusText("Fetching proof details...");
        const proof = lookup.proofId
          ? await getProofById(lookup.proofId)
          : null;
        setFoundProof(proof);
        setFoundTxDigest(lookup.txDigest);
        setResult("match");
        track({
          name: "verify_result",
          props: { result: "match", mode: "image", durationMs: Date.now() - startedAt },
        });
      } else {
        setResult("not_found");
        track({
          name: "verify_result",
          props: { result: "not_found", mode: "image", durationMs: Date.now() - startedAt },
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setErrorMsg(msg);
      captureException(error, { where: "verifyByImage" });
      track({
        name: "verify_result",
        props: { result: "error", mode: "image", error: msg.slice(0, 200) },
      });
    } finally {
      setLoading(false);
      setStatusText("");
    }
  };

  const verifyByHash = async () => {
    if (!imageUri || !expectedHash.trim()) {
      showAlert("Missing input", "Select an image and enter the expected hash.");
      return;
    }

    track({ name: "verify_started", props: { mode: "hash" } });

    try {
      setLoading(true);
      setErrorMsg("");
      setStatusText("Computing image hash...");
      const hash = await hashImage(imageUri);
      setComputedHash(hash);
      const matched = hash === expectedHash.trim();
      setResult(matched ? "match" : "mismatch");
      track({
        name: "verify_result",
        props: { result: matched ? "match" : "mismatch", mode: "hash" },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setErrorMsg(msg);
      captureException(error, { where: "verifyByHash" });
      track({
        name: "verify_result",
        props: { result: "error", mode: "hash", error: msg.slice(0, 200) },
      });
    } finally {
      setLoading(false);
      setStatusText("");
    }
  };

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Mode selector */}
      <View style={styles.modeSelector}>
        <TouchableOpacity
          style={[styles.modeButton, mode === "image" && styles.modeActive]}
          onPress={() => { setMode("image"); setResult(null); }}
        >
          <Text style={[styles.modeText, mode === "image" && styles.modeTextActive]}>
            Verify on Chain
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, mode === "hash" && styles.modeActive]}
          onPress={() => { setMode("hash"); setResult(null); }}
        >
          <Text style={[styles.modeText, mode === "hash" && styles.modeTextActive]}>
            Compare Hash
          </Text>
        </TouchableOpacity>
      </View>

      {/* Image picker */}
      {imageUri ? (
        <TouchableOpacity onPress={pickImage}>
          <Image source={{ uri: imageUri }} style={styles.preview} />
          <Text style={styles.tapHint}>Tap image to change</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.placeholder} onPress={pickImage}>
          <Text style={styles.placeholderIcon}>+</Text>
          <Text style={styles.placeholderText}>Select image to verify</Text>
        </TouchableOpacity>
      )}

      {/* Hash input (only in hash mode) */}
      {mode === "hash" && (
        <TextInput
          style={styles.input}
          placeholder="Paste expected image hash..."
          placeholderTextColor="#555"
          value={expectedHash}
          onChangeText={setExpectedHash}
          autoCapitalize="none"
          autoCorrect={false}
        />
      )}

      {/* Error display */}
      {errorMsg ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText} selectable>{errorMsg}</Text>
        </View>
      ) : null}

      {/* Result display */}
      {result && (
        <View
          style={[
            styles.resultBox,
            result === "match"
              ? styles.matchBox
              : result === "not_found"
              ? styles.notFoundBox
              : styles.mismatchBox,
          ]}
        >
          <Text style={styles.resultEmoji}>
            {result === "match" ? "✓" : result === "not_found" ? "?" : "✗"}
          </Text>
          <Text style={styles.resultTitle}>
            {result === "match"
              ? "VERIFIED"
              : result === "not_found"
              ? "NOT FOUND"
              : "MISMATCH"}
          </Text>
          <Text style={styles.resultDetail}>
            {result === "match"
              ? "This image matches a proof recorded on Sui."
              : result === "not_found"
              ? "No on-chain proof found for this image."
              : "The computed hash does not match the expected hash."}
          </Text>

          {computedHash ? (
            <Text style={styles.hashText} selectable>
              Hash: {computedHash}
            </Text>
          ) : null}

          {/* Proof details when found */}
          {foundProof && (
            <View style={styles.proofDetails}>
              <DetailRow label="Creator" value={foundProof.creator} />
              <DetailRow label="Walrus Blob" value={foundProof.walrusBlobId} />
              <DetailRow label="Proof Hash" value={foundProof.proofHash} />
              {foundProof.coarseGeoHash ? (
                <DetailRow label="Location" value={foundProof.coarseGeoHash} />
              ) : null}
              <DetailRow
                label="Date"
                value={
                  foundProof.createdAt
                    ? new Date(foundProof.createdAt).toLocaleString()
                    : "Unknown"
                }
                mono={false}
              />

              {/* Explorer links */}
              {foundTxDigest ? (
                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={() => openLink(`${explorerBase}/tx/${foundTxDigest}`)}
                >
                  <Text style={styles.linkText}>View Transaction</Text>
                </TouchableOpacity>
              ) : null}

              {foundProof.walrusBlobId ? (
                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={() =>
                    openLink(
                      `${WALRUS_AGGREGATOR_URL}/v1/blobs/${foundProof.walrusBlobId}`
                    )
                  }
                >
                  <Text style={styles.linkText}>View Image on Walrus</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </View>
      )}

      {/* Actions */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#e94560" />
          <Text style={styles.statusText}>{statusText}</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.button, styles.verifyButton]}
          onPress={mode === "image" ? verifyByImage : verifyByHash}
        >
          <Text style={styles.buttonText}>
            {mode === "image" ? "Verify on Sui" : "Compare Hashes"}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

function DetailRow({
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
    <View style={detailStyles.row}>
      <Text style={detailStyles.label}>{label}</Text>
      <Text
        style={[detailStyles.value, mono && detailStyles.mono]}
        numberOfLines={2}
        selectable
      >
        {value}
      </Text>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  row: { marginBottom: 10 },
  label: { color: "#888", fontSize: 10, textTransform: "uppercase" },
  value: { color: "#fff", fontSize: 12 },
  mono: { fontFamily: "monospace" },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a1a2e" },
  content: { padding: 16, paddingBottom: 40 },
  modeSelector: {
    flexDirection: "row",
    backgroundColor: "#16213e",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  modeButton: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  modeActive: { backgroundColor: "#0f3460" },
  modeText: { color: "#666", fontSize: 14, fontWeight: "600" },
  modeTextActive: { color: "#fff" },
  preview: { height: 200, borderRadius: 12, marginBottom: 4 },
  tapHint: { color: "#555", fontSize: 11, textAlign: "center", marginBottom: 16 },
  placeholder: {
    height: 200,
    borderRadius: 12,
    backgroundColor: "#16213e",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#333",
    borderStyle: "dashed",
  },
  placeholderIcon: { color: "#555", fontSize: 40, marginBottom: 4 },
  placeholderText: { color: "#555", fontSize: 16 },
  input: {
    backgroundColor: "#16213e",
    color: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 14,
    marginBottom: 16,
    fontFamily: "monospace",
  },
  errorBox: { backgroundColor: "#641220", borderRadius: 12, padding: 16, marginBottom: 16 },
  errorText: { color: "#ff6b6b", fontSize: 13, fontFamily: "monospace" },
  resultBox: { padding: 20, borderRadius: 16, marginBottom: 16, alignItems: "center" },
  matchBox: { backgroundColor: "#1b4332" },
  notFoundBox: { backgroundColor: "#2d2d2d" },
  mismatchBox: { backgroundColor: "#641220" },
  resultEmoji: { fontSize: 40, marginBottom: 8 },
  resultTitle: { color: "#fff", fontSize: 24, fontWeight: "bold", marginBottom: 8 },
  resultDetail: { color: "#ccc", fontSize: 14, textAlign: "center", marginBottom: 12 },
  hashText: { color: "#888", fontSize: 10, fontFamily: "monospace", marginBottom: 8 },
  proofDetails: {
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: "#444",
    paddingTop: 16,
    marginTop: 8,
  },
  linkButton: {
    backgroundColor: "#0f3460",
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
    alignItems: "center",
  },
  linkText: { color: "#5dade2", fontSize: 13, fontWeight: "500" },
  loadingContainer: { alignItems: "center", paddingVertical: 20 },
  statusText: { color: "#aaa", marginTop: 12, fontSize: 14 },
  button: { paddingVertical: 16, borderRadius: 12, alignItems: "center" },
  verifyButton: { backgroundColor: "#0f3460" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
