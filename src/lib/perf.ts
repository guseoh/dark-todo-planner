/**
 * Startup timeline for diagnosing slowness on the real machine. Open the browser console and run
 * `dtpPerf()`: it lists when each startup step happened (ms since navigation start) and how long the
 * server spent on the bootstrap request (Server-Timing).
 */
const marks = new Map<string, number>();

export function markStartup(name: string): void {
  if (typeof performance === "undefined" || marks.has(name)) return;
  marks.set(name, Math.round(performance.now()));
  try { performance.mark(`dtp:${name}`); } catch { /* marks are diagnostics only */ }
}

export function startupReport(): Record<string, unknown> {
  const report: Record<string, unknown> = Object.fromEntries(marks);
  if (typeof performance !== "undefined" && typeof performance.getEntriesByType === "function") {
    const bootstrap = (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).find((entry) => entry.name.includes("/api/bootstrap"));
    if (bootstrap) {
      report["bootstrap-network-ms"] = Math.round(bootstrap.responseEnd - bootstrap.startTime);
      report["bootstrap-server-ms"] = bootstrap.serverTiming?.find((timing) => timing.name === "app")?.duration;
    }
    const paint = performance.getEntriesByType("paint").find((entry) => entry.name === "first-contentful-paint");
    if (paint) report["first-contentful-paint"] = Math.round(paint.startTime);
  }
  return report;
}

if (typeof window !== "undefined") {
  (window as unknown as { dtpPerf: () => Record<string, unknown> }).dtpPerf = startupReport;
}
