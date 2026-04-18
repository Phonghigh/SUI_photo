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
import { useRouter, Stack } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import { useFocusEffect } from "expo-router";
import { OnboardingModal } from "../src/components/OnboardingModal";
import { enqueueProof, getOutboxQueue } from "../src/services/outbox";
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
import { loadSettings, saveSettings, type AppSettings } from "../src/services/settings";
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
  const [liveHash, setLiveHash] = useState<string>("");
  const [timeWarning, setTimeWarning] = useState<string>("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [outboxCount, setOutboxCount] = useState(0);
  const [settings, setSettings] = useState<AppSettings>({
    cameraOnlyMode: false,
    hasSeenOnboarding: false,
  });

  // Refresh outbox count and wallet balance every time screen is focused
  useFocusEffect(() => {
    getOutboxQueue().then((q) => {
      setOutboxCount(q.filter(i => i.status !== "uploading").length);
    });
    initWallet(); // Refresh SUI balance
  });

  useEffect(() => {
    checkOnboarding();
    initWallet();
    requestLocationPermission();
    checkTimeDrift();
    loadSettings().then(setSettings);
  }, []);

  const checkTimeDrift = async () => {
    try {
      const response = await fetch("https://worldtimeapi.org/api/ip");
      const data = await response.json();
      const networkTime = new Date(data.utc_datetime).getTime();
      const localTime = Date.now();
      if (Math.abs(networkTime - localTime) > 120_000) { // 2 minutes
        setTimeWarning("⚠️ Device clock is inaccurate. Proof timestamp may be contested.");
      }
    } catch (e) {
      console.warn("Could not check network time", e);
    }
  };

  const checkOnboarding = async () => {
    try {
      const completed = await SecureStore.getItemAsync("onboarding_completed");
      if (!completed) {
        setShowOnboarding(true);
      }
    } catch (e) {
      console.warn("SecureStore error", e);
    }
  };

  const completeOnboarding = async () => {
    try {
      await SecureStore.setItemAsync("onboarding_completed", "true");
      await saveSettings({ hasSeenOnboarding: true });
    } catch (e) {
      console.warn("SecureStore error", e);
    }
    setShowOnboarding(false);
  };

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
      const uri = result.assets[0].uri;
      setImageUri(uri);
      setExif(result.assets[0].exif ?? null);
      setErrorMsg("");
      setLiveHash("Computing...");
      const hash = await hashImage(uri);
      setLiveHash(hash);
      track({ name: "image_hashed", props: { source: "camera" } });
    }
  };

  const pickFromLibrary = async () => {
    if (settings.cameraOnlyMode) {
      showAlert(
        "Camera-Only Mode",
        "Library picking is disabled. Turn off camera-only mode in Settings to use your photo library."
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      exif: true,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setImageUri(uri);
      setExif(result.assets[0].exif ?? null);
      setErrorMsg("");
      setLiveHash("Computing...");
      const hash = await hashImage(uri);
      setLiveHash(hash);
      track({ name: "image_hashed", props: { source: "library" } });
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

      // Step 1: Hash the image (use pre-computed liveHash if available)
      stage = "hash_image";
      setStatus("Hashing image...");
      logger.debug("CAPTURE", "Step 1: Hashing image...");
      const imageHash =
        liveHash && liveHash !== "Computing..."
          ? liveHash
          : await hashImage(imageUri);
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
      } else {
        // Enqueue to outbox on network failure
        try {
          await enqueueProof(imageUri, exif, currentLocation, liveHash, message);
          showAlert(
            "Saved to Outbox",
            "Upload failed. Your proof has been saved securely to your local Outbox and will be uploaded automatically when connectivity is restored."
          );
          // Clear current image so they can take another
          setImageUri(null);
          setLiveHash("");
          // Refresh count
          getOutboxQueue().then((q) => setOutboxCount(q.length));
        } catch (enqueueError) {
          logger.error("CAPTURE", "Failed to enqueue outbox", { enqueueError });
          setErrorMsg("Upload failed, and could not save to Outbox.");
        }
      }
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <TouchableOpacity
                onPress={() => router.push("/outbox")}
                style={{ paddingHorizontal: 12 }}
              >
                <Text style={{ fontSize: 18 }}>
                  📤 {outboxCount > 0 ? `(${outboxCount})` : ""}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push("/settings")}
                style={{ paddingHorizontal: 12 }}
              >
                <Text style={{ fontSize: 18 }}>⚙️</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowOnboarding(true)}
                style={{ paddingHorizontal: 12 }}
              >
                <Text style={{ fontSize: 20 }}>ℹ️</Text>
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <OnboardingModal
        visible={showOnboarding}
        onComplete={completeOnboarding}
      />
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

        {/* Time warning */}
        {timeWarning ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>{timeWarning}</Text>
          </View>
        ) : null}

        {/* Camera-only mode indicator */}
        {settings.cameraOnlyMode ? (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              🔒 Camera-only mode: Library picking is disabled.
            </Text>
          </View>
        ) : null}

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

        {/* Live hash preview */}
        {liveHash ? (
          <View style={styles.hashBar}>
            <Text style={styles.hashLabel}>IMAGE HASH (LIVE)</Text>
            <Text style={styles.hashValue} selectable numberOfLines={2}>
              {liveHash === "Computing..."
                ? "Computing…"
                : `${liveHash.slice(0, 16)}…${liveHash.slice(-12)}`}
            </Text>
          </View>
        ) : null}

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
              style={[
                styles.button,
                styles.libraryButton,
                settings.cameraOnlyMode && styles.buttonDisabled,
              ]}
              onPress={pickFromLibrary}
              disabled={settings.cameraOnlyMode}
            >
              <Text style={styles.buttonText}>
                {settings.cameraOnlyMode
                  ? "Library Disabled (Camera-Only Mode)"
                  : "Pick from Library"}
              </Text>
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
    </>
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
  warningBox: {
    backgroundColor: "#4a2e00",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#ffb84d",
  },
  warningText: {
    color: "#ffb84d",
    fontSize: 12,
  },
  infoBox: {
    backgroundColor: "#0f3460",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  infoText: {
    color: "#5dade2",
    fontSize: 12,
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
    marginBottom: 12,
  },
  placeholder: {
    height: 300,
    borderRadius: 12,
    backgroundColor: "#16213e",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  placeholderText: {
    color: "#555",
    fontSize: 16,
  },
  hashBar: {
    backgroundColor: "#16213e",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#4ecca3",
  },
  hashLabel: {
    color: "#666",
    fontSize: 9,
    letterSpacing: 1,
    marginBottom: 4,
  },
  hashValue: {
    color: "#4ecca3",
    fontSize: 11,
    fontFamily: "monospace",
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
  buttonDisabled: {
    opacity: 0.4,
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
