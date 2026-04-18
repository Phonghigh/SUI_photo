import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { exportSecretKey } from "../services/wallet";

interface Props {
  visible: boolean;
  onComplete: () => void;
}

export function OnboardingModal({ visible, onComplete }: Props) {
  const [step, setStep] = useState(1);
  const [secretKey, setSecretKey] = useState<string>("");

  useEffect(() => {
    if (visible && step === 3) {
      exportSecretKey().then(setSecretKey).catch(console.warn);
    }
  }, [visible, step]);

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      onComplete();
      setStep(1); // Reset for future manual opens
    }
  };

  const copyKey = async () => {
    if (secretKey) {
      await Clipboard.setStringAsync(secretKey);
      if (Platform.OS === "web") {
        window.alert("Secret key copied to clipboard!");
      } else {
        const { Alert } = require("react-native");
        Alert.alert("Copied", "Secret key copied to clipboard!");
      }
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onComplete}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Step 1 */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.title}>SnapProof gives your photo a receipt.</Text>
              <Text style={styles.paragraph}>
                We anchor the exact digital fingerprint (hash) of your photo to the Sui blockchain the moment you take it.
              </Text>
              <Text style={styles.paragraph}>
                This guarantees cryptographic integrity: anyone can prove that these exact bytes existed at this exact time.
              </Text>
            </View>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.title}>What it proves (and doesn't)</Text>
              <View style={styles.list}>
                <Text style={styles.listItem}>
                  <Text style={styles.check}>✓ PROVES:</Text> The exact bytes of the image file have not been altered since the moment of capture.
                </Text>
                <Text style={styles.listItem}>
                  <Text style={styles.check}>✓ PROVES:</Text> The photo existed prior to the timestamp of the blockchain transaction.
                </Text>
                <Text style={styles.listItem}>
                  <Text style={styles.cross}>✗ DOES NOT PROVE:</Text> That the photo is "real" or free of AI generation. If your camera captures an AI-generated screen, SnapProof only proves you captured *that screen* at that time.
                </Text>
              </View>
            </View>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <View style={styles.stepContent}>
              <Text style={styles.title}>Your wallet is on this device.</Text>
              <Text style={styles.paragraph}>
                SnapProof uses a local cryptographic wallet to sign your proofs. There are no passwords and no centralized servers holding your keys.
              </Text>
              <Text style={styles.paragraph}>
                If you lose this device or delete the app, you will lose the ability to prove you were the original creator.
              </Text>
              <TouchableOpacity style={styles.copyButton} onPress={copyKey}>
                <Text style={styles.copyButtonText}>Copy Secret Key to Password Manager</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Pagination and Actions */}
          <View style={styles.footer}>
            <View style={styles.dots}>
              {[1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={[styles.dot, step === i && styles.activeDot]}
                />
              ))}
            </View>
            <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
              <Text style={styles.nextButtonText}>
                {step === 3 ? "Get Started" : "Next"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "#16213e",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "#0f3460",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  stepContent: {
    minHeight: 250,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 16,
    lineHeight: 32,
  },
  paragraph: {
    fontSize: 16,
    color: "#ccc",
    marginBottom: 16,
    lineHeight: 24,
  },
  list: {
    gap: 16,
  },
  listItem: {
    fontSize: 15,
    color: "#ccc",
    lineHeight: 22,
  },
  check: {
    color: "#4ecca3",
    fontWeight: "bold",
  },
  cross: {
    color: "#ff6b6b",
    fontWeight: "bold",
  },
  copyButton: {
    backgroundColor: "#0f3460",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  copyButtonText: {
    color: "#5dade2",
    fontWeight: "600",
    fontSize: 14,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 32,
  },
  dots: {
    flexDirection: "row",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#333",
  },
  activeDot: {
    backgroundColor: "#e94560",
    width: 24,
  },
  nextButton: {
    backgroundColor: "#e94560",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  nextButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});
