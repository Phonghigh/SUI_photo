import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Platform } from "react-native";

const STORAGE_KEY = "snapproof-keypair";

let cachedKeypair: Ed25519Keypair | null = null;

/**
 * Get or create a local keypair for signing transactions.
 * Uses localStorage on web, expo-file-system on native.
 */
export async function getKeypair(): Promise<Ed25519Keypair> {
  if (cachedKeypair) return cachedKeypair;

  try {
    const saved = await loadKeypair();
    if (saved) {
      cachedKeypair = Ed25519Keypair.fromSecretKey(saved);
      console.log("Loaded existing keypair:", cachedKeypair.toSuiAddress());
      return cachedKeypair;
    }
  } catch (error) {
    console.warn("Failed to load keypair, creating new one:", error);
  }

  // Generate a new keypair
  cachedKeypair = new Ed25519Keypair();
  const address = cachedKeypair.toSuiAddress();
  console.log("Generated new keypair:", address);

  // Save for reuse
  try {
    await saveKeypair(cachedKeypair.getSecretKey(), address);
  } catch (error) {
    console.warn("Failed to save keypair:", error);
  }

  return cachedKeypair;
}

async function loadKeypair(): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      const json = window.localStorage.getItem(STORAGE_KEY);
      if (json) {
        const { secretKey } = JSON.parse(json);
        return secretKey;
      }
    } catch {}
    return null;
  }

  // Native: use expo-secure-store for encrypted storage
  try {
    const SecureStore = await import("expo-secure-store");
    const secretKey = await SecureStore.getItemAsync(STORAGE_KEY);
    return secretKey;
  } catch (error) {
    console.warn("SecureStore load error:", error);
  }
  return null;
}

async function saveKeypair(secretKey: string, address: string): Promise<void> {
  const data = JSON.stringify({ secretKey, address });

  if (Platform.OS === "web") {
    try {
      window.localStorage.setItem(STORAGE_KEY, data);
    } catch {}
    return;
  }

  try {
    const SecureStore = await import("expo-secure-store");
    // We only save the secretKey in SecureStore for maximum security
    // The address can be re-derived if needed, but for simplicity here we just store the key
    await SecureStore.setItemAsync(STORAGE_KEY, secretKey);
  } catch (error) {
    console.warn("SecureStore save error:", error);
  }
}

/**
 * Get the current wallet address.
 */
export async function getAddress(): Promise<string> {
  const keypair = await getKeypair();
  return keypair.toSuiAddress();
}

/**
 * Get the wallet's raw secret key (for backup).
 */
export async function exportSecretKey(): Promise<string> {
  const keypair = await getKeypair();
  return keypair.getSecretKey();
}

/**
 * Request testnet SUI tokens from the faucet.
 */
export async function requestTestnetTokens(): Promise<boolean> {
  try {
    const address = await getAddress();
    const response = await fetch("https://faucet.testnet.sui.io/v1/gas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        FixedAmountRequest: { recipient: address },
      }),
    });

    if (!response.ok) {
      console.warn("Faucet request failed:", response.status);
      return false;
    }

    console.log("Faucet tokens received for:", address);
    return true;
  } catch (error) {
    console.warn("Faucet request error:", error);
    return false;
  }
}
