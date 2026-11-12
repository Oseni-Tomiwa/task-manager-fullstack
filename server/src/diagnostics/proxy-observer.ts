import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { isIP } from "node:net";
import { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

const probes = new Set([
  "a_direct_base",
  "a_direct_spoof",
  "a_proxy_base",
  "a_proxy_spoof",
  "b_direct_base",
  "b_direct_spoof",
  "b_proxy_base",
  "b_proxy_spoof",
]);
const maxLifetime = 15 * 60 * 1000;
type Snapshot = {
  probe: string;
  socket: Buffer | null;
  current: Buffer | null;
  xff: Buffer[];
  real: Buffer | null;
  vercel: Buffer | null;
};
const equal = (a: Buffer | null | undefined, b: Buffer | null | undefined) =>
  a && b ? timingSafeEqual(a, b) : null;

// No request, environment value, address, digest or error is ever serialized.
// The budget and deduplication are process-local, not deployment-wide.
export function createProxyObserver(
  source: Record<string, string | undefined> = process.env,
): (req: Request) => void {
  try {
    const configured = settings(source);
    return configured ? configuredObserver(configured) : () => undefined;
  } catch {
    return () => undefined;
  }
}

function settings(source: Record<string, string | undefined>) {
  if (source.PROXY_OBSERVER_ENABLED !== "1") return null;
  const secret = source.PROXY_OBSERVER_SECRET;
  const expiry = source.PROXY_OBSERVER_EXPIRES_AT;
  if (!expiry || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(expiry))
    return null;
  const expiresAt = Date.parse(expiry);
  const remaining = expiresAt - Date.now();
  if (
    !secret ||
    !/^[a-f\d]{64}$/i.test(secret) ||
    !Number.isFinite(remaining) ||
    remaining <= 0 ||
    remaining > maxLifetime ||
    new Date(expiresAt).toISOString() !== expiry
  )
    return null;
  return {
    expiresAt,
    remaining,
    deadline: performance.now() + remaining,
    gate: createHash("sha256").update(secret).digest(),
  };
}

function configuredObserver(
  configured: NonNullable<ReturnType<typeof settings>>,
): (req: Request) => void {
  // Only derived gate material enters this closure, never the source environment.
  const { expiresAt, deadline } = configured;
  let gate: Buffer | null = configured.gate;
  let salt: Buffer | null = randomBytes(32);
  const seen = new Map<string, Snapshot>();
  function erase(snapshot: Snapshot) {
    for (const value of [
      snapshot.socket,
      snapshot.current,
      snapshot.real,
      snapshot.vercel,
      ...snapshot.xff,
    ])
      value?.fill(0);
  }
  function stop() {
    gate?.fill(0);
    gate = null;
    salt?.fill(0);
    salt = null;
    for (const snapshot of seen.values()) erase(snapshot);
    seen.clear();
    clearTimeout(timer);
  }
  const timer = setTimeout(stop, Math.max(0, deadline - performance.now()));
  timer.unref();
  function digest(value: string, key = true): Buffer {
    // Use the exact installed limiter's IPv6 normalization for candidate keys.
    const normalized = key
      ? ipKeyGenerator(value, 56)
      : isIP(value) === 6
        ? new URL(`http://[${value}]/`).hostname
        : value;
    return createHmac("sha256", salt!)
      .update(key ? "key:" : "socket:")
      .update(normalized)
      .digest();
  }
  function address(value: unknown): string | null | false {
    if (value === undefined) return null;
    if (
      typeof value !== "string" ||
      value.length > 64 ||
      value.includes("%") ||
      !isIP(value)
    )
      return false;
    return value;
  }
  return (req) => {
    let snapshot: Snapshot | undefined;
    try {
      if (!gate) return;
      if (Date.now() >= expiresAt || performance.now() >= deadline) {
        stop();
        return;
      }
      const supplied = req.headers["x-taskflow-observer-key"];
      if (
        typeof supplied !== "string" ||
        supplied.length !== 64 ||
        !/^[a-f\d]{64}$/i.test(supplied)
      )
        return;
      const suppliedDigest = createHash("sha256").update(supplied).digest();
      const authorized = timingSafeEqual(gate, suppliedDigest);
      suppliedDigest.fill(0);
      if (!authorized) return;
      const probe = req.headers["x-taskflow-observer-probe"];
      if (
        typeof probe !== "string" ||
        probe.length > 16 ||
        !probes.has(probe) ||
        seen.has(probe)
      )
        return;
      const rawXff = req.headers["x-forwarded-for"];
      if (
        rawXff !== undefined &&
        (typeof rawXff !== "string" || rawXff.length > 512)
      )
        return;
      const xff =
        rawXff === undefined
          ? []
          : (rawXff as string).split(",").map((value) => value.trim());
      if (xff.length > 8 || xff.some((value) => address(value) === false))
        return;
      const socket = address(req.socket.remoteAddress);
      const current = address(req.ip);
      const real = address(req.headers["x-real-ip"]);
      const vercel = address(req.headers["x-vercel-forwarded-for"]);
      if (!socket || !current || real === false || vercel === false) return;
      snapshot = {
        probe,
        socket: socket ? digest(socket, false) : null,
        current: current ? digest(current) : null,
        xff: xff.map((value) => digest(value)),
        real: real ? digest(real) : null,
        vercel: vercel ? digest(vercel) : null,
      };
      const comparisons = [...seen.values()].map((previous) => ({
        probe: previous.probe,
        socket_equal: equal(snapshot!.socket, previous.socket),
        current_key_equal: equal(snapshot!.current, previous.current),
        xff_first_key_equal: equal(snapshot!.xff[0], previous.xff[0]),
        xff_last_key_equal: equal(snapshot!.xff.at(-1), previous.xff.at(-1)),
        real_key_equal: equal(snapshot!.real, previous.real),
        vercel_key_equal: equal(snapshot!.vercel, previous.vercel),
        xff_from_right_keys_equal: Array.from(
          { length: Math.max(snapshot!.xff.length, previous.xff.length) },
          (_, i) => equal(snapshot!.xff.at(-1 - i), previous.xff.at(-1 - i)),
        ),
      }));
      // Recheck after inspection so elapsed work or a wall-clock jump cannot log late.
      if (Date.now() >= expiresAt || performance.now() >= deadline) {
        erase(snapshot);
        stop();
        return;
      }
      // Reserve the unique case before logging; logger failure cannot permit retry.
      seen.set(probe, snapshot);
      console.info(
        JSON.stringify({
          event: "proxy_observation",
          probe,
          xff_count: xff.length,
          comparisons,
        }),
      );
      if (seen.size === 8) stop();
    } catch {
      if (snapshot) erase(snapshot);
      // Fail closed without forwarding diagnostic exceptions to request middleware.
      stop();
    }
  };
}
