#!/usr/bin/env node

const DEFAULT_BASE_URL = 'https://worker-auth.onrender.com';

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
    return [key, value];
  }),
);

const baseUrl = (args.get('base-url') || process.env.DIAG_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
const count = Math.max(1, Number(args.get('count') || process.env.DIAG_COUNT || 6));
const intervalMs = Math.max(1000, Number(args.get('interval-ms') || process.env.DIAG_INTERVAL_MS || 2000));
const timeoutMs = Math.max(1000, Number(args.get('timeout-ms') || process.env.DIAG_TIMEOUT_MS || 10000));

const endpoints = [
  '/health',
  '/api/v1/categories',
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function percentile(values, pct) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((pct / 100) * sorted.length) - 1);
  return sorted[index];
}

async function timedFetch(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    await response.arrayBuffer();
    return {
      path,
      status: response.status,
      ok: response.ok,
      timedOut: false,
      durationMs: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    return {
      path,
      status: error?.name === 'AbortError' ? 'TIMEOUT' : 'ERROR',
      ok: false,
      timedOut: error?.name === 'AbortError',
      durationMs: Math.round(performance.now() - startedAt),
      error: error?.message || String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

const results = [];

console.log(JSON.stringify({
  event: 'diagnostic_start',
  baseUrl,
  count,
  intervalMs,
  timeoutMs,
  endpoints,
  startedAt: new Date().toISOString(),
}));

for (let i = 0; i < count; i += 1) {
  for (const path of endpoints) {
    const result = await timedFetch(path);
    results.push(result);
    console.log(JSON.stringify({
      event: 'diagnostic_request',
      attempt: i + 1,
      ...result,
      at: new Date().toISOString(),
    }));
  }

  if (i < count - 1) await sleep(intervalMs);
}

const latencies = results.filter(result => Number.isFinite(result.durationMs)).map(result => result.durationMs);
const statusCounts = results.reduce((acc, result) => {
  acc[result.status] = (acc[result.status] || 0) + 1;
  return acc;
}, {});
const successCount = results.filter(result => result.ok).length;
const timeoutCount = results.filter(result => result.timedOut).length;

console.log(JSON.stringify({
  event: 'diagnostic_summary',
  total: results.length,
  successCount,
  failureCount: results.length - successCount,
  timeoutCount,
  averageLatencyMs: latencies.length
    ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length)
    : 0,
  p95LatencyMs: percentile(latencies, 95),
  statusCounts,
  finishedAt: new Date().toISOString(),
}));
