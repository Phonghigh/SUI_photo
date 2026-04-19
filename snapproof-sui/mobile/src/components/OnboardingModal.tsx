import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Dimensions,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Feather, Ionicons } from "@expo/vector-icons";
import { exportSecretKey } from "../services/wallet";
import { GlassCard, CoralButton, CyanButton } from "./Glass";
import { C, TYPE } from "../theme/tokens";
import { FadeUp } from "./FadeUp";

const { width } = Dimensions.get("window");

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
      const { Alert } = require("react-native");
      Alert.alert("Copied", "Secret key copied to clipboard!");
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onComplete}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <GlassCard radius={32} tone="cyan">
            <View style={styles.card}>
              <View style={styles.stepHeader}>
                <View style={styles.iconCircle}>
                  {step === 1 && <Feather name="shield" size={28} color={C.mint} />}
                  {step === 2 && <Feather name="check-circle" size={28} color={C.cyan} />}
                  {step === 3 && <Feather name="key" size={28} color={C.coral} />}
                </View>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>STEP 0{step}</Text>
                </View>
              </View>

              <View style={styles.stepContent}>
                {/* Step 1 */}
                {step === 1 && (
                  <View>
                    <Text style={styles.title}>Your photo gets a digital receipt.</Text>
                    <Text style={styles.paragraph}>
                      SnapProof anchors the exact digital fingerprint of your photo to the Sui blockchain the moment you take it.
                    </Text>
                    <Text style={styles.paragraph}>
                      This guarantees that these exact pixels existed at this exact time, proven by math.
                    </Text>
                  </View>
                )}

                {/* Step 2 */}
                {step === 2 && (
                  <View>
                    <Text style={styles.title}>What it proves</Text>
                    <View style={styles.list}>
                      <View style={styles.listItem}>
                        <Ionicons name="checkmark-circle" size={18} color={C.mint} />
                        <Text style={styles.listText}>Image hasn't been altered since capture</Text>
                      </View>
                      <View style={styles.listItem}>
                        <Ionicons name="checkmark-circle" size={18} color={C.mint} />
                        <Text style={styles.listText}>The photo existed at the timestamp</Text>
                      </View>
                      <View style={[styles.listItem, { opacity: 0.6 }]}>
                        <Ionicons name="alert-circle" size={18} color={C.slate} />
                        <Text style={styles.listText}>Doesn't prove if AI was used off-screen</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Step 3 */}
                {step === 3 && (
                  <View>
                    <Text style={styles.title}>Your keys, your proofs.</Text>
                    <Text style={styles.paragraph}>
                      SnapProof uses a local wallet to sign your proofs. There are no passwords and no central servers.
                    </Text>
                    <Text style={styles.paragraph}>
                      If you delete the app without saving your key, you lose your digital identity.
                    </Text>
                    <TouchableOpacity style={styles.copyBox} onPress={copyKey} activeOpacity={0.7}>
                      <View style={styles.copyHeader}>
                        <Text style={styles.copyLabel}>SECRET RECOVERY KEY</Text>
                        <Feather name="copy" size={14} color={C.cyan} />
                      </View>
                      <Text style={styles.keyText} numberOfLines={1}>
                        {secretKey || "Generating your secure key..."}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Footer */}
              <View style={styles.footer}>
                <View style={styles.dots}>
                  {[1, 2, 3].map((i) => (
                    <View
                      key={i}
                      style={[styles.dot, step === i && styles.activeDot]}
                    />
                  ))}
                </View>
                <CoralButton onPress={handleNext} style={styles.nextBtn}>
                  <View style={styles.btnInner}>
                    <Text style={styles.nextText}>
                      {step === 3 ? "Launch App" : "Next Step"}
                    </Text>
                    <Feather name="arrow-right" size={18} color="#fff" />
                  </View>
                </CoralButton>
              </View>
            </View>
          </GlassCard>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(3, 5, 12, 0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    width: width - 40,
    maxWidth: 400,
  },
  card: {
    padding: 24,
  },
  stepHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.03)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  stepBadge: {
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  stepBadgeText: {
    color: C.silver,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  stepContent: {
    minHeight: 280,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: C.textPrimary,
    marginBottom: 16,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  paragraph: {
    fontSize: 16,
    color: C.silver,
    marginBottom: 16,
    lineHeight: 24,
  },
  list: {
    gap: 16,
    marginTop: 8,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  listText: {
    color: C.textPrimary,
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  copyBox: {
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(60,200,240,0.15)",
    marginTop: 8,
  },
  copyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  copyLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: C.cyan,
    letterSpacing: 1,
  },
  keyText: {
    color: C.silver,
    fontSize: 13,
    fontFamily: "monospace",
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
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  activeDot: {
    backgroundColor: C.coral,
    width: 24,
  },
  nextBtn: {
    paddingHorizontal: 20,
  },
  btnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  nextText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
});
