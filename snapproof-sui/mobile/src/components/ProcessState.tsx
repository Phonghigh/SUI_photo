import React from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import Svg, { Circle as SvgCircle } from "react-native-svg";
import { Feather, Ionicons } from "@expo/vector-icons";
import { GlassCard } from "./Glass";
import { C, TYPE } from "../theme/tokens";

interface Step {
  label: string;
  detail: string;
}

interface ProcessStateProps {
  title: string;
  subtitle: string;
  steps: Step[];
  currentStep: number;
  totalSteps: number;
  icon: "camera" | "shield" | "sparkles" | string;
  tone?: "cyan" | "default";
}

export const ProcessState = ({
  title,
  subtitle,
  steps,
  currentStep,
  totalSteps,
  icon,
  tone = "cyan",
}: ProcessStateProps) => {
  const progress = currentStep / totalSteps;
  const strokeDasharray = 2 * Math.PI * 44;
  const strokeDashoffset = strokeDasharray * (1 - progress);

  const renderIcon = () => {
    switch (icon) {
      case "camera":
        return <Feather name="camera" size={32} color={C.coral} />;
      case "shield":
        return <Feather name="shield" size={32} color={C.mint} />;
      case "sparkles":
        return <Ionicons name="sparkles" size={32} color={C.coral} />;
      default:
        return <Text style={styles.iconText}>{icon}</Text>;
    }
  };

  return (
    <View style={styles.container}>
      <GlassCard tone={tone} radius={24}>
        <View style={styles.inner}>
          {/* Progress Circle */}
          <View style={styles.visualContainer}>
            <View style={styles.glow} />
            <Svg viewBox="0 0 100 100" style={styles.svg}>
              <SvgCircle
                cx="50"
                cy="50"
                r="44"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="3"
                fill="none"
              />
              <SvgCircle
                cx="50"
                cy="50"
                r="44"
                stroke={C.coral}
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
              />
            </Svg>
            <View style={styles.iconCenter}>
              {renderIcon()}
            </View>
          </View>

          <Text style={styles.eyebrow}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <View style={styles.stepsContainer}>
            {steps.map((s, i) => {
              const done = i < currentStep;
              const active = i === currentStep;
              return (
                <View
                  key={s.label}
                  style={[
                    styles.stepRow,
                    done ? styles.stepDone : active ? styles.stepActive : styles.stepIdle,
                  ]}
                >
                  <View
                    style={[
                      styles.stepNum,
                      done ? styles.stepNumDone : active ? styles.stepNumActive : styles.stepNumIdle,
                    ]}
                  >
                    {done ? (
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    ) : (
                      <Text style={styles.stepNumText}>{i + 1}</Text>
                    )}
                  </View>
                  <Text style={styles.stepLabel}>{s.label}</Text>
                  <Text style={styles.stepDetail}>{s.detail}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </GlassCard>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  inner: {
    padding: 24,
    alignItems: "center",
  },
  visualContainer: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  glow: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(240,86,110,0.15)",
    shadowColor: C.coral,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  svg: {
    position: "absolute",
    width: 120,
    height: 120,
    transform: [{ rotate: "-90deg" }],
  },
  iconCenter: {
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 28,
  },
  eyebrow: {
    ...TYPE.eyebrow,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: "800",
    color: C.textPrimary,
    marginBottom: 24,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  stepsContainer: {
    width: "100%",
    gap: 12,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  stepDone: {
    backgroundColor: "rgba(64,224,163,0.04)",
    borderColor: "rgba(64,224,163,0.12)",
  },
  stepActive: {
    backgroundColor: "rgba(60,200,240,0.04)",
    borderColor: "rgba(60,200,240,0.12)",
  },
  stepIdle: {
    backgroundColor: "rgba(255,255,255,0.02)",
    borderColor: "rgba(255,255,255,0.05)",
  },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumDone: { backgroundColor: C.mint },
  stepNumActive: { backgroundColor: C.coral },
  stepNumIdle: { backgroundColor: "rgba(255,255,255,0.05)" },
  stepNumText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  stepLabel: {
    flex: 1,
    color: C.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  stepDetail: {
    color: C.slate,
    fontSize: 12,
    fontFamily: "monospace",
  },
});
