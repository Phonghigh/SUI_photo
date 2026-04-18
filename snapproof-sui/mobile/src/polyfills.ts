/**
 * Polyfills required for the Sui SDK to work in React Native.
 * Must be imported before any Sui SDK usage.
 */

// Ensure crypto.getRandomValues is available globally
if (typeof global !== "undefined" && !global.crypto) {
  // React Native environment — use expo-crypto as fallback
  (global as any).crypto = {
    getRandomValues: (array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    },
  };
}

if (typeof global !== "undefined" && global.crypto && !global.crypto.getRandomValues) {
  (global.crypto as any).getRandomValues = (array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  };
}

// Also try the proper polyfill package
try {
  require("react-native-get-random-values");
} catch (_) {
  // Already handled above
}
