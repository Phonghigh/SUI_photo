/**
 * Glass.tsx — SnapProof premium glass primitives.
 * Matches the template's .glass / .glass-cyan / bg-gradient-coral system,
 * implemented with expo-linear-gradient and the RN Animated API.
 */
import { View, TouchableOpacity, StyleSheet, Text, Animated, Easing, Platform, type ViewStyle, type StyleProp } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C, SHADOWS } from "../theme/tokens";
import { useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type GlassTone = "default" | "cyan" | "coral" | "success";

interface GlassProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: GlassTone;
  onPress?: () => void;
  radius?: number;
  noPad?: boolean;
}

// ─── Border colors per tone ────────────────────────────────────────────────────
const TONE_BORDER: Record<GlassTone, string> = {
  default: C.glassBorder,
  cyan:    C.cyanBorder,
  coral:   "rgba(240,86,110,0.28)",
  success: C.mintBorder,
};

// ─── GlassCard ────────────────────────────────────────────────────────────────

export function GlassCard({ children, style, tone = "default", onPress, radius = 24, noPad }: GlassProps) {
  const borderColor = TONE_BORDER[tone];

  const inner = (
    <View style={[s.cardWrap, { borderRadius: radius, borderColor }, style]}>
      {/* Glass background gradient */}
      <LinearGradient
        colors={["rgba(28,40,74,0.60)", "rgba(12,18,42,0.50)"]}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      {/* Rim light — top highlight edge */}
      <LinearGradient
        colors={["rgba(220,235,255,0.14)", "rgba(220,235,255,0.02)", "rgba(220,235,255,0)"]}
        locations={[0, 0.4, 1]}
        style={[s.rimLight, { borderRadius: radius }]}
        pointerEvents="none"
      />
      {/* Tone accent glow (bottom-inner) */}
      {tone === "cyan" && (
        <LinearGradient
          colors={["transparent", "rgba(60,200,240,0.06)"]}
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
          pointerEvents="none"
        />
      )}
      {tone === "coral" && (
        <LinearGradient
          colors={["transparent", "rgba(240,86,110,0.08)"]}
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
          pointerEvents="none"
        />
      )}
      {tone === "success" && (
        <LinearGradient
          colors={["transparent", "rgba(64,224,163,0.06)"]}
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
          pointerEvents="none"
        />
      )}
      {/* Content */}
      <View style={noPad ? undefined : s.cardContent}>
        {children}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.82}>
        {inner}
      </TouchableOpacity>
    );
  }
  return inner;
}

// ─── CoralButton ──────────────────────────────────────────────────────────────
// Full-width pill button with coral gradient + shadow (Primary CTA)

interface CoralButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function CoralButton({ children, onPress, style }: CoralButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.86}
      style={style}
      accessibilityRole="button"
    >
      <LinearGradient
        // Contrast-tuned: middle stop is coralDeep so white labels sitting
        // at the visual center of the pill pass WCAG 1.4.3 (≈ 4.5:1).
        // Top edge keeps coralGlow → coral for brand identity.
        colors={[C.coralGlow, C.coralDeep, C.coralDeep]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={[s.coralBtn, SHADOWS.coral]}
      >
        {/* Inner highlight rim */}
        <LinearGradient
          colors={["rgba(255,255,255,0.28)", "transparent"]}
          style={s.coralRim}
          pointerEvents="none"
        />
        <View style={s.coralContent}>{children}</View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ─── CyanButton ───────────────────────────────────────────────────────────────
// Secondary pill button with cyan glass treatment

export function CyanButton({ children, onPress, style }: CoralButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={style}
      accessibilityRole="button"
    >
      <View style={[s.cyanBtn, SHADOWS.cyan]}>
        <LinearGradient
          colors={["rgba(28,40,74,0.65)", "rgba(12,18,42,0.55)"]}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={["rgba(220,235,255,0.14)", "transparent"]}
          style={s.cyanRim}
          pointerEvents="none"
        />
        <View style={s.coralContent}>{children}</View>
      </View>
    </TouchableOpacity>
  );
}

// ─── StatusPill ───────────────────────────────────────────────────────────────
// The small network chip in the top-right of every header

interface StatusPillProps {
  network?: string;
  status?: string;
}

export function StatusPill({ network = "Sui", status = "Testnet" }: StatusPillProps) {
  return (
    <View style={s.statusOuter}>
      <LinearGradient
        colors={["rgba(28,40,74,0.72)", "rgba(12,18,42,0.65)"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.statusDotWrap}>
        <View style={s.statusDotPulse} />
        <View style={s.statusDot} />
      </View>
      <Text style={s.statusText}>
        {network} <Text style={{ color: C.slate }}>· {status}</Text>
      </Text>
    </View>
  );
}

// ─── Grid Overlay ─────────────────────────────────────────────────────────────
function GridOverlay() {
  return (
    <View style={[StyleSheet.absoluteFill, { opacity: 0.03 }]} pointerEvents="none">
      {Array.from({ length: 20 }).map((_, i) => (
        <View key={`h-${i}`} style={{ position: "absolute", top: `${i * 5}%`, left: 0, right: 0, height: 1, backgroundColor: "#fff" }} />
      ))}
      {Array.from({ length: 12 }).map((_, i) => (
        <View key={`v-${i}`} style={{ position: "absolute", left: `${i * 8.33}%`, top: 0, bottom: 0, width: 1, backgroundColor: "#fff" }} />
      ))}
    </View>
  );
}

// ─── Stars ────────────────────────────────────────────────────────────────────
// Individual twinkling star component
function TwinklingStar({ size, top, left, delay }: { size: number, top: string, left: string, delay: number }) {
  const opacity = useRef(new Animated.Value(Math.random() * 0.5 + 0.2)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.1,
          duration: 1500 + Math.random() * 1000,
          delay: delay,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: 1500 + Math.random() * 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={{
        position: "absolute",
        top,
        left,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#fff",
        opacity,
        shadowColor: "#fff",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: size,
      }}
    />
  );
}

// Pre-generate star positions to avoid re-renders
const STARS_DATA = Array.from({ length: 40 }).map((_, i) => ({
  id: i,
  size: Math.random() * 2 + 1,
  top: `${Math.random() * 100}%`,
  left: `${Math.random() * 100}%`,
  delay: Math.random() * 3000,
}));

// ─── GlowBackground ───────────────────────────────────────────────────────────
// Page-level atmospheric background: deep midnight + 2 radial blobs

interface GlowBgProps {
  children: React.ReactNode;
  topColor?: string;
  bottomColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function GlowBackground({
  children,
  topColor = "#ff0080", // Fuchsia
  bottomColor = "#7928ca", // Purple
  style,
}: GlowBgProps) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 30000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const rotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const moveX = (d: number) => anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, d, 0] });
  const moveY = (d: number) => anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, d, 0] });

  return (
    <View style={[s.bgWrap, style]}>
      {/* Deepest Base */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "#020408" }]} />
      
      {/* Hyper-Mesh Blobs */}
      <Animated.View style={[s.blob, { top: -100, left: -50, width: 400, height: 400, backgroundColor: topColor, transform: [{ translateX: moveX(40) }, { translateY: moveY(20) }, { rotate }] }]} />
      <Animated.View style={[s.blob, { bottom: -100, right: -50, width: 500, height: 500, backgroundColor: bottomColor, transform: [{ translateX: moveX(-30) }, { translateY: moveY(-50) }] }]} />
      <Animated.View style={[s.blob, { top: "30%", right: -150, width: 350, height: 350, backgroundColor: "#00dfd8", transform: [{ translateX: moveX(-60) }, { translateY: moveY(40) }] }]} />
      <Animated.View style={[s.blob, { bottom: "20%", left: -100, width: 300, height: 300, backgroundColor: "#4facfe", transform: [{ rotate }] }]} />

      <GridOverlay />

      {/* Twinkling Stars */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {STARS_DATA.map(star => (
          <TwinklingStar key={star.id} {...star} />
        ))}
      </View>

      <LinearGradient
        colors={["rgba(2,4,8,0.7)", "rgba(2,4,8,0.2)", "rgba(2,4,8,0.8)"]}
        style={StyleSheet.absoluteFill}
      />

      {children}
    </View>
  );
}

// ─── PageHeader ──────────────────────────────────────────────────────────────

interface PageHeaderProps {
  title: string;
  onBack?: () => void;
  rightElement?: React.ReactNode;
}

import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

export function PageHeader({ title, onBack, rightElement }: PageHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <View style={[s.headerWrap, { paddingTop: insets.top + 10 }]}>
      <TouchableOpacity 
        onPress={handleBack} 
        style={s.headerBackBtn}
        activeOpacity={0.7}
        hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
      >
        <Feather name="arrow-left" size={22} color={C.silver} />
      </TouchableOpacity>

      <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
      
      <View style={{ minWidth: 44, alignItems: "flex-end" }}>
        {rightElement || <StatusPill />}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // GlassCard
  cardWrap: {
    borderWidth: 1,
    overflow: "hidden",
    ...SHADOWS.glass,
  },
  rimLight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "40%",
  },
  cardContent: {
    padding: 0, // consumers control their own padding
  },

  // CoralButton
  coralBtn: {
    borderRadius: 100,
    overflow: "hidden",
  },
  coralRim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
    borderRadius: 100,
    opacity: 0.6,
  },
  coralContent: {
    paddingVertical: 18,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
  },

  // CyanButton
  cyanBtn: {
    borderRadius: 100,
    borderWidth: 1,
    borderColor: C.cyanBorder,
    overflow: "hidden",
  },
  cyanRim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "45%",
    borderRadius: 100,
  },

  // StatusPill
  statusOuter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: C.glassBorder,
    overflow: "hidden",
  },
  statusDotWrap: {
    width: 8,
    height: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  statusDotPulse: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.mint,
    opacity: 0.4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.mint,
  },
  statusText: {
    color: C.silver,
    fontSize: 12,
    fontWeight: "600",
  },

  // GlowBackground
  bgWrap: { flex: 1, backgroundColor: "#020408", overflow: "hidden" },
  blob: {
    position: "absolute",
    borderRadius: 1000,
    opacity: 0.15,
    filter: Platform.OS === 'ios' ? 'blur(100px)' : undefined,
  },
  // PageHeader
  headerWrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 20,
    backgroundColor: "transparent",
    width: "100%",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: -0.4,
  },
  headerBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
});
