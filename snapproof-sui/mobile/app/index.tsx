import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SnapProof</Text>
      <Text style={styles.subtitle}>
        Timestamp and verify photo evidence on Sui
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/capture")}
      >
        <Text style={styles.buttonText}>Capture Photo</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.secondaryButton]}
        onPress={() => router.push("/verify")}
      >
        <Text style={[styles.buttonText, styles.secondaryButtonText]}>
          Verify Photo
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.mapButton]}
        onPress={() => router.push("/map")}
      >
        <Text style={styles.buttonText}>Proof Map</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#e94560",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#aaa",
    textAlign: "center",
    marginBottom: 48,
  },
  button: {
    backgroundColor: "#e94560",
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    marginBottom: 16,
    width: "100%",
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#e94560",
  },
  secondaryButtonText: {
    color: "#e94560",
  },
  mapButton: {
    backgroundColor: "#0f3460",
  },
});
