import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import {
  hashImage,
  extractMetadata,
  hashMetadata,
  computeProofHash,
} from "../src/utils/hash";
import { encodeGeohash } from "../src/utils/geohash";
import { uploadToWalrus } from "../src/services/walrus";
import { createProofOnSui, getBalance } from "../src/services/sui";
import { getAddress, requestTestnetTokens } from "../src/services/wallet";
import { logger } from "../src/utils/logger";
import { track, captureException, setUser } from "../src/services/analytics";
import type { ProofData } from "../src/types/proof";

/** Cross-platform alert that works on web too */
function showAlert(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    const { Alert } = require("react-native");
    Alert.alert(title, message);
  }
}

export default function CaptureScreen() {
  const router = useRouter();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [balance, setBalance] = useState<string>("");
  const [exif, setExif] = useState<Record<string, any> | null>(null);
  const [locationStatus, setLocationStatus] = useState<
    "pending" | "granted" | "denied"
  >("pending");
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  useEffect(() => {
    initWallet();
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      track({ name: "permission_granted", props: { permission: "location", result: status } });
      if (status === "granted") {
        setLocationStatus("granted");
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setCurrentLocation({
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
        });
      } else {
        setLocationStatus("denied");
      }
    } catch (error) {
      console.warn("Location error:", error);
      setLocationStatus("denied");
      captureException(error, { where: "requestLocationPermission" });
    }
  };

  const initWallet = async () => {
    try {
      const addr = await getAddress();
      setWalletAddress(addr);
      setUser(addr);
      const bal = await getBalance();
      const suiBalance = Number(bal) / 1_000_000_000;
      setBalance(suiBalance.toFixed(4));
      if (suiBalance > 0) {
        track({ name: "wallet_funded", props: { balanceSui: suiBalance } });
      }
    } catch (error) {
      console.warn("Wallet init error:", error);
      captureException(error, { where: "initWallet" });
    }
  };

  const handleFaucet = async () => {
    setStatus("Requesting testnet tokens...");
    setErrorMsg("");
    setLoading(true);
    track({ name: "faucet_requested" });
    const success = await requestTestnetTokens();
    setLoading(false);
    setStatus("");
    track({ name: "faucet_result", props: { success } });
    if (success) {
      showAlert("Success", "Testnet SUI tokens received!");
      await initWallet();
    } else {
      showAlert("Failed", "Could not get testnet tokens. Try again later or use: sui client transfer-sui");
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      exif: true,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setExif(result.assets[0].exif ?? null);
      setErrorMsg("");
    }
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      exif: true,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setExif(result.assets[0].exif ?? null);
      setErrorMsg("");
    }
  };

  const submitProof = async () => {
    if (!imageUri) return;

    console.log("[SnapProof] Starting submit flow...");
    logger.info("CAPTURE", "Starting submission flow", { imageUri });
    setErrorMsg("");

    const startedAt = Date.now();
    track({ name: "proof_submit_started", props: { hasLocation: !!currentLocation } });

    let stage: string = "init";
    try {
      setLoading(true);

      // Step 1: Hash the image
      stage = "hash_image";
      setStatus("Hashing image...");
      logger.debug("CAPTURE", "Step 1: Hashing image...");
      const imageHash = await hashImage(imageUri);
      logger.info("CAPTURE", "Image hash generated", { imageHash });

      // Step 2: Extract and hash metadata
      stage = "hash_metadata";
      setStatus("Processing metadata...");
      logger.debug("CAPTURE", "Step 2: Processing metadata...");
      const metadata = await extractMetadata(imageUri, exif ?? undefined);
      const metadataHash = await hashMetadata(metadata);
      logger.info("CAPTURE", "Metadata hash generated", { metadataHash });

      // Step 3: Compute combined proof hash
      stage = "hash_proof";
      const proofHash = await computeProofHash(imageHash, metadataHash);
      logger.info("CAPTURE", "Combined proof hash generated", { proofHash });

      // Step 4: Capture location
      stage = "geohash";
      setStatus("Capturing location...");
      logger.debug("CAPTURE", "Step 4: Processing location...");
      let coarseGeoHash = "";
      if (currentLocation) {
        coarseGeoHash = encodeGeohash(
          currentLocation.lat,
          currentLocation.lng,
          6
        );
        logger.info("CAPTURE", "Geohash computed", { coarseGeoHash });
      } else {
        logger.warn("CAPTURE", "No location available, skipping geohash");
      }

      // Step 5: Upload to Walrus
      stage = "walrus_upload";
      setStatus("Uploading to Walrus...");
      logger.debug("CAPTURE", "Step 5: Uploading to Walrus...");
      const walrusResult = await uploadToWalrus(imageUri);
      logger.info("CAPTURE", "Walrus upload complete", { blobId: walrusResult.blobId });

      // Step 6: Create proof on Sui
      stage = "sui_tx";
      setStatus("Creating proof on Sui...");
      logger.debug("CAPTURE", "Step 6: Creating proof on Sui...");
      const proof: ProofData = {
        imageHash,
        metadataHash,
        proofHash,
        walrusBlobId: walrusResult.blobId,
        createdAt: metadata.timestamp,
        creator: walletAddress,
        coarseGeoHash: coarseGeoHash || undefined,
      };
      const { txDigest, objectId } = await createProofOnSui(proof);
      logger.info("CAPTURE", "Sui transaction successful", { txDigest, objectId });

      setLoading(false);

      track({
        name: "proof_submit_succeeded",
        props: {
          durationMs: Date.now() - startedAt,
          hasGeoHash: !!coarseGeoHash,
          walrusBlobId: walrusResult.blobId,
        },
      });

      // Navigate to proof receipt
      router.push({
        pathname: "/proof",
        params: {
          imageHash: proof.imageHash,
          metadataHash: proof.metadataHash,
          proofHash: proof.proofHash,
          walrusBlobId: proof.walrusBlobId,
          txDigest,
          objectId,
          createdAt: String(proof.createdAt),
          creator: walletAddress,
          coarseGeoHash: coarseGeoHash || "",
        },
      });
    } catch (error) {
      setLoading(false);
      const message = error instanceof Error ? error.message : String(error);
      logger.error("CAPTURE", "Submission failed", { error: message, stage });
      setErrorMsg(message);
      setStatus("");

      track({
        name: "proof_submit_failed",
        props: {
          stage,
          durationMs: Date.now() - startedAt,
          error: message.slice(0, 200),
        },
      });
      captureException(error, { stage, where: "submitProof" });

      if (message.includes("No valid gas") || message.includes("balance")) {
        setErrorMsg(
          `No SUI tokens! Fund this address:\n\n${walletAddress}\n\nRun in terminal:\nsui client transfer-sui --to ${walletAddress} --sui-coin-object-id <YOUR_COIN_ID> --amount 300000000 --gas-budget 10000000`
        );
      }
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Wallet info bar */}
      <View style={styles.walletBar}>
        <View style={styles.walletInfo}>
          <Text style={styles.walletLabel}>WALLET</Text>
          <Text style={styles.walletAddress} numberOfLines={2} selectable>
            {walletAddress || "Loading..."}
          </Text>
        </View>
        <View style={styles.balanceInfo}>
          <Text style={styles.walletLabel}>BALANCE</Text>
          <Text style={styles.balanceText}>{balance || "..."} SUI</Text>
        </View>
        <TouchableOpacity style={styles.faucetButton} onPress={handleFaucet}>
          <Text style={styles.faucetButtonText}>Faucet</Text>
        </TouchableOpacity>
      </View>

      {/* Location status */}
      <View style={styles.locationBar}>
        <Text style={styles.locationDot}>
          {locationStatus === "granted" ? "●" : "○"}
        </Text>
        <Text style={styles.locationText}>
          {locationStatus === "granted"
            ? currentLocation
              ? `Location: ${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}`
              : "Getting location..."
            : locationStatus === "denied"
            ? "Location disabled — proof will have no geotag"
            : "Requesting location..."}
        </Text>
        {locationStatus === "denied" && (
          <TouchableOpacity onPress={requestLocationPermission}>
            <Text style={styles.locationRetry}>Enable</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Image preview */}
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.preview} />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>No photo captured</Text>
        </View>
      )}

      {/* Error display */}
      {errorMsg ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText} selectable>{errorMsg}</Text>
        </View>
      ) : null}

      {/* Actions */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#e94560" />
          <Text style={styles.statusText}>{status}</Text>
        </View>
      ) : (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.button} onPress={pickImage}>
            <Text style={styles.buttonText}>
              {imageUri ? "Retake Photo" : "Take Photo"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.libraryButton]}
            onPress={pickFromLibrary}
          >
            <Text style={styles.buttonText}>Pick from Library</Text>
          </TouchableOpacity>

          {imageUri && (
            <TouchableOpacity
              style={[styles.button, styles.submitButton]}
              onPress={submitProof}
            >
              <Text style={styles.buttonText}>Submit Proof to Sui</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  walletBar: {
    flexDirection: "row",
    backgroundColor: "#16213e",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    alignItems: "center",
  },
  walletInfo: {
    flex: 1,
  },
  balanceInfo: {
    marginRight: 12,
  },
  walletLabel: {
    color: "#666",
    fontSize: 10,
    textTransform: "uppercase",
  },
  walletAddress: {
    color: "#aaa",
    fontSize: 12,
    fontFamily: "monospace",
  },
  balanceText: {
    color: "#4ecca3",
    fontSize: 14,
    fontWeight: "600",
  },
  faucetButton: {
    backgroundColor: "#0f3460",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  faucetButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  locationBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16213e",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  locationDot: {
    color: "#4ecca3",
    fontSize: 14,
    marginRight: 8,
  },
  locationText: {
    color: "#aaa",
    fontSize: 12,
    flex: 1,
  },
  locationRetry: {
    color: "#5dade2",
    fontSize: 12,
    fontWeight: "600",
  },
  preview: {
    height: 300,
    borderRadius: 12,
    marginBottom: 16,
  },
  placeholder: {
    height: 300,
    borderRadius: 12,
    backgroundColor: "#16213e",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  placeholderText: {
    color: "#555",
    fontSize: 16,
  },
  errorBox: {
    backgroundColor: "#641220",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  errorText: {
    color: "#ff6b6b",
    fontSize: 13,
    fontFamily: "monospace",
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 24,
  },
  statusText: {
    color: "#aaa",
    marginTop: 12,
    fontSize: 14,
  },
  actions: {
    gap: 12,
  },
  button: {
    backgroundColor: "#e94560",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  libraryButton: {
    backgroundColor: "#533483",
  },
  submitButton: {
    backgroundColor: "#0f3460",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
