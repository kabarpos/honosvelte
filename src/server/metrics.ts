/**
 * In-process metrics (OPS-02): cheap monotonic counters + bounded latency
 * samples, exposed as plain JSON at /health/metrics for a scraping agent or
 * a monitoring sidecar. No PII is ever recorded — only aggregate counters
 * and percentiles. The data is intentionally in-memory (resets on restart);
 * persistent metrics belong to an external collector.
 */
const counters: Record<string, number> = {};
/** Bounded latency samples per label (rolling window, newest first). */
const samples = new Map<string, number[]>();
const MAX_SAMPLES = 256;

/** Increment a named counter (created on first use). */
export function inc(name: string, by = 1): void {
	counters[name] = (counters[name] ?? 0) + by;
}

/** Record one latency sample (ms) under `label`; window is bounded. */
export function addLatency(label: string, ms: number): void {
	let bucket = samples.get(label);
	if (!bucket) {
		bucket = [];
		samples.set(label, bucket);
	}
	bucket.push(ms);
	if (bucket.length > MAX_SAMPLES) bucket.shift();
}

function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) return 0;
	const idx = Math.min(
		sorted.length - 1,
		Math.ceil((p / 100) * sorted.length) - 1,
	);
	return sorted[idx] ?? 0;
}

export interface MetricsSnapshot {
	uptimeSeconds: number;
	startedAt: string;
	counters: Record<string, number>;
	latency: Record<
		string,
		{
			count: number;
			sum: number;
			max: number;
			p50: number;
			p95: number;
			p99: number;
		}
	>;
}

const startedAt = new Date().toISOString();
const startMs = Date.now();

/** Point-in-time snapshot for the /health/metrics endpoint. */
export function snapshot(): MetricsSnapshot {
	const latency: MetricsSnapshot["latency"] = {};
	for (const [label, values] of samples) {
		const sorted = [...values].sort((a, b) => a - b);
		latency[label] = {
			count: values.length,
			sum: values.reduce((a, b) => a + b, 0),
			max: sorted[sorted.length - 1] ?? 0,
			p50: percentile(sorted, 50),
			p95: percentile(sorted, 95),
			p99: percentile(sorted, 99),
		};
	}
	return {
		uptimeSeconds: Math.floor((Date.now() - startMs) / 1000),
		startedAt,
		counters: { ...counters },
		latency,
	};
}
