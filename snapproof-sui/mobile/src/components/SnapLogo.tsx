import React from "react";
import { View, Text, StyleSheet } from "react-native";
import  {
  Svg,
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Path,
  Circle,
} from "react-native-svg";
import { C } from "../theme/tokens";

interface SnapLogoProps {
  style?: any;
  showText?: boolean;
}

export const SnapLogo = ({ style, showText = true }: SnapLogoProps) => {
  return (
    <View style={[styles.container, style]}>
      <Svg
        width="28"
        height="28"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
      >
        <Defs>
          <LinearGradient id="sp-mark" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#f4697e" />
            <Stop offset="100%" stopColor="#d1435a" />
          </LinearGradient>
          <LinearGradient id="sp-inner" x1="0" y1="0" x2="0" y2="32" gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <Stop offset="100%" stopColor="#c5ccd8" stopOpacity="0.7" />
          </LinearGradient>
        </Defs>
        {/* Outer aperture ring */}
        <Rect
          x="1.5"
          y="1.5"
          width="29"
          height="29"
          rx="9"
          stroke="url(#sp-mark)"
          strokeWidth="1.5"
          fill="#050813"
        />
        {/* Aperture blades — geometric hexagon */}
        <Path
          d="M16 7L23 11.5V20.5L16 25L9 20.5V11.5L16 7Z"
          stroke="url(#sp-inner)"
          strokeWidth="1.3"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Seal dot center */}
        <Circle cx="16" cy="16" r="2.4" fill="url(#sp-mark)" />
        <Circle cx="16" cy="16" r="2.4" fill="url(#sp-mark)" opacity="0.6" />
      </Svg>
      {showText && (
        <Text style={styles.text}>
          Snap<Text style={{ color: C.coral }}>Proof</Text>
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  text: {
    marginLeft: 10,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: "#f0f2f8",
  },
});
