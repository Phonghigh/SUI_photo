/**
 * Minimal zero-dependency Prometheus text-format metrics exporter.
 * Avoids pulling in `prom-client` for a dozen counters.
 */

type LabelSet = Record<string, string>;

interface Counter {
  kind: "counter";
  help: string;
  labelNames: string[];
  values: Map<string, number>;
}

interface Histogram {
  kind: "histogram";
  help: string;
  labelNames: string[];
  buckets: number[];
  counts: Map<string, number[]>;
  sums: Map<string, number>;
  observations: Map<string, number>;
}

type Metric = Counter | Histogram;

const metrics = new Map<string, Metric>();

function labelKey(labelNames: string[], labels?: LabelSet): string {
  if (!labelNames.length) return "";
  return labelNames.map((n) => `${n}=${labels?.[n] ?? ""}`).join("|");
}

function formatLabels(labelNames: string[], key: string, extra?: LabelSet): string {
  const parts: string[] = [];
  if (key) {
    const pairs = key.split("|");
    for (const p of pairs) {
      const [name, value] = p.split("=");
      if (value) parts.push(`${name}="${escape(value)}"`);
    }
  }
  if (extra) {
    for (const [k, v] of Object.entries(extra)) parts.push(`${k}="${escape(v)}"`);
  }
  return parts.length ? `{${parts.join(",")}}` : "";
}

function escape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

export function counter(name: string, help: string, labelNames: string[] = []): {
  inc: (labels?: LabelSet, delta?: number) => void;
} {
  if (!metrics.has(name)) {
    metrics.set(name, {
      kind: "counter",
      help,
      labelNames,
      values: new Map(),
    });
  }
  const c = metrics.get(name) as Counter;
  return {
    inc(labels, delta = 1) {
      const key = labelKey(c.labelNames, labels);
      c.values.set(key, (c.values.get(key) ?? 0) + delta);
    },
  };
}

export function histogram(
  name: string,
  help: string,
  labelNames: string[] = [],
  buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
): {
  observe: (value: number, labels?: LabelSet) => void;
} {
  if (!metrics.has(name)) {
    metrics.set(name, {
      kind: "histogram",
      help,
      labelNames,
      buckets,
      counts: new Map(),
      sums: new Map(),
      observations: new Map(),
    });
  }
  const h = metrics.get(name) as Histogram;
  return {
    observe(value, labels) {
      const key = labelKey(h.labelNames, labels);
      if (!h.counts.has(key)) h.counts.set(key, new Array(h.buckets.length).fill(0));
      const bucketCounts = h.counts.get(key)!;
      for (let i = 0; i < h.buckets.length; i++) {
        if (value <= h.buckets[i]) bucketCounts[i]++;
      }
      h.sums.set(key, (h.sums.get(key) ?? 0) + value);
      h.observations.set(key, (h.observations.get(key) ?? 0) + 1);
    },
  };
}

export function renderMetrics(): string {
  const lines: string[] = [];
  for (const [name, metric] of metrics) {
    lines.push(`# HELP ${name} ${metric.help}`);
    lines.push(`# TYPE ${name} ${metric.kind}`);
    if (metric.kind === "counter") {
      for (const [key, value] of metric.values) {
        lines.push(`${name}${formatLabels(metric.labelNames, key)} ${value}`);
      }
    } else {
      for (const [key, counts] of metric.counts) {
        let cumulative = 0;
        for (let i = 0; i < metric.buckets.length; i++) {
          cumulative += counts[i];
          lines.push(
            `${name}_bucket${formatLabels(metric.labelNames, key, {
              le: String(metric.buckets[i]),
            })} ${cumulative}`
          );
        }
        const total = metric.observations.get(key) ?? 0;
        lines.push(
          `${name}_bucket${formatLabels(metric.labelNames, key, { le: "+Inf" })} ${total}`
        );
        lines.push(`${name}_sum${formatLabels(metric.labelNames, key)} ${metric.sums.get(key) ?? 0}`);
        lines.push(`${name}_count${formatLabels(metric.labelNames, key)} ${total}`);
      }
    }
  }
  return lines.join("\n") + "\n";
}

// Pre-declared metrics used across routes.
export const httpRequests = counter(
  "snapproof_http_requests_total",
  "Total HTTP requests",
  ["method", "route", "status"]
);
export const httpDuration = histogram(
  "snapproof_http_request_duration_seconds",
  "HTTP request duration in seconds",
  ["method", "route", "status"]
);
export const proofQueryTotal = counter(
  "snapproof_proof_query_total",
  "Total proof queries by result",
  ["result"]
);
export const verifyResult = counter(
  "snapproof_verify_result_total",
  "Verify endpoint result counter",
  ["result"]
);
