import { Platform } from "react-native";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogConfig {
  level: LogLevel;
  enabled: boolean;
}

const CONFIG: LogConfig = {
  level: __DEV__ ? "debug" : "info",
  enabled: true,
};

const COLORS = {
  debug: "⚪",
  info: "🔵",
  warn: "🟠",
  error: "🔴",
};

/**
 * Structured Logger for SnapProof.
 * Usage: logger.info("SUI", "Transaction successful", { digest: "..." });
 */
class Logger {
  private format(level: LogLevel, category: string, message: string): string {
    const timestamp = new Date().toLocaleTimeString([], { hour12: false });
    return `${COLORS[level]} [${timestamp}] [${category}] ${message}`;
  }

  private shouldLog(level: LogLevel): boolean {
    if (!CONFIG.enabled) return false;
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    return levels.indexOf(level) >= levels.indexOf(CONFIG.level);
  }

  debug(category: string, message: string, data?: any) {
    if (this.shouldLog("debug")) {
      console.log(this.format("debug", category, message), data ?? "");
    }
  }

  info(category: string, message: string, data?: any) {
    if (this.shouldLog("info")) {
      console.log(this.format("info", category, message), data ?? "");
    }
  }

  warn(category: string, message: string, data?: any) {
    if (this.shouldLog("warn")) {
      console.warn(this.format("warn", category, message), data ?? "");
    }
  }

  error(category: string, message: string, data?: any) {
    if (this.shouldLog("error")) {
      console.error(this.format("error", category, message), data ?? "");
    }
  }
}

export const logger = new Logger();
