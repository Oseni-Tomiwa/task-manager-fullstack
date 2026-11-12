import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Request } from "express";
import { createProxyObserver } from "../src/diagnostics/proxy-observer.js";

const secret = "ab".repeat(32); // Synthetic test secret only.
const epoch = Date.parse("2026-11-05T12:00:00Z");
const tags = [
  "a_direct_base",
  "a_direct_spoof",
  "a_proxy_base",
  "a_proxy_spoof",
  "b_direct_base",
  "b_direct_spoof",
  "b_proxy_base",
  "b_proxy_spoof",
];
function config() {
  return {
    PROXY_OBSERVER_ENABLED: "1",
    PROXY_OBSERVER_SECRET: secret,
    PROXY_OBSERVER_EXPIRES_AT: new Date(epoch + 900000).toISOString(),
  };
}
function req(
  tag = tags[0]!,
  key = secret,
  xff = "192.0.2.1",
  ip = "127.0.0.1",
) {
  return {
    headers: {
      "x-taskflow-observer-key": key,
      "x-taskflow-observer-probe": tag,
      "x-forwarded-for": xff,
      "x-real-ip": "192.0.2.1",
      "x-vercel-forwarded-for": "192.0.2.1",
    },
    socket: { remoteAddress: "127.0.0.1" },
    ip,
  } as unknown as Request;
}
beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["Date", "setTimeout", "clearTimeout", "performance"],
  });
  vi.setSystemTime(epoch);
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
const logger = () =>
  vi.spyOn(console, "info").mockImplementation(() => undefined);
it.each([undefined, "0", "true", " 1"])("is disabled for flag %s", (flag) => {
  const log = logger();
  const observe = createProxyObserver({
    ...config(),
    PROXY_OBSERVER_ENABLED: flag,
  });
  observe(req());
  expect(log).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
it.each([
  { PROXY_OBSERVER_SECRET: "weak" },
  { PROXY_OBSERVER_SECRET: undefined },
  { PROXY_OBSERVER_EXPIRES_AT: "invalid" },
  { PROXY_OBSERVER_EXPIRES_AT: "2026-11-05T12:05:00" },
  { PROXY_OBSERVER_EXPIRES_AT: new Date(epoch).toISOString() },
  { PROXY_OBSERVER_EXPIRES_AT: new Date(epoch + 900001).toISOString() },
])("fails closed for invalid configuration", (invalid) => {
  const log = logger();
  createProxyObserver({ ...config(), ...invalid })(req());
  expect(log).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
it("rejects wrong/missing/oversized/duplicate gates without consuming budget", () => {
  const log = logger();
  const observe = createProxyObserver(config());
  for (const key of ["", "cd".repeat(32), "x".repeat(10000)])
    observe(req(tags[0], key));
  const duplicate = req();
  duplicate.headers["x-taskflow-observer-key"] = [secret, secret];
  observe(duplicate);
  observe(req("untrusted-tag"));
  for (const tag of tags) observe(req(tag));
  expect(log).toHaveBeenCalledTimes(8);
});
it("allows each fixed tag once and caps observations at eight", () => {
  const log = logger();
  const observe = createProxyObserver(config());
  observe(req());
  observe(req());
  for (const tag of tags.slice(1)) observe(req(tag));
  observe(req(tags[0]));
  expect(log).toHaveBeenCalledTimes(8);
  expect(vi.getTimerCount()).toBe(0);
});
it("expires at the absolute deadline, including without traffic", () => {
  const log = logger();
  const observe = createProxyObserver(config());
  vi.advanceTimersByTime(899999);
  observe(req());
  expect(log).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(1);
  observe(req(tags[1]));
  expect(log).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
  const expired = createProxyObserver(config());
  expired(req());
  expect(log).toHaveBeenCalledTimes(1);
});
it("wall-clock rollback cannot extend its monotonic lifetime", () => {
  const log = logger();
  const observe = createProxyObserver(config());
  vi.setSystemTime(epoch - 86400000);
  vi.advanceTimersByTime(900000);
  observe(req());
  expect(log).not.toHaveBeenCalled();
});
it("reports only bounded counts and comparisons across controlled cases", () => {
  const log = logger();
  const observe = createProxyObserver(config());
  observe(req(tags[0], secret, "192.0.2.1"));
  observe(req(tags[1], secret, "198.51.100.2"));
  const second = JSON.parse(log.mock.calls[1]![0]);
  expect(second).toEqual({
    event: "proxy_observation",
    probe: tags[1],
    xff_count: 1,
    comparisons: [
      {
        probe: tags[0],
        socket_equal: true,
        current_key_equal: true,
        xff_first_key_equal: false,
        xff_last_key_equal: false,
        real_key_equal: true,
        vercel_key_equal: true,
        xff_from_right_keys_equal: [false],
      },
    ],
  });
});
it("does not confuse absent fields with matching identities", () => {
  const log = logger();
  const observe = createProxyObserver(config());
  const a = req();
  delete a.headers["x-real-ip"];
  delete a.headers["x-vercel-forwarded-for"];
  delete a.headers["x-forwarded-for"];
  observe(a);
  observe({
    ...a,
    headers: { ...a.headers, "x-taskflow-observer-probe": tags[1] },
  } as unknown as Request);
  expect(
    JSON.parse(log.mock.calls[1]![0]).comparisons[0].real_key_equal,
  ).toBeNull();
  expect(JSON.parse(log.mock.calls[0]![0]).xff_count).toBe(0);
});
it("bounds and validates forwarding inputs without logging or consuming budget", () => {
  const log = logger();
  const observe = createProxyObserver(config());
  for (const xff of [
    "SECRET_PASSWORD_URI",
    "192.0.2.1,".repeat(9),
    "x".repeat(10000),
    "192.0.2.1:3000",
  ])
    observe(req(tags[0], secret, xff));
  observe(req());
  expect(log).toHaveBeenCalledTimes(1);
});
it("does not expose raw addresses, secret, headers or cookies and never serializes requests", () => {
  const log = logger();
  const observe = createProxyObserver(config());
  const input = req();
  input.headers.cookie = "PRIVATE_COOKIE_TOKEN";
  input.headers.authorization = "PRIVATE_CREDENTIAL";
  Object.defineProperty(input, "toJSON", {
    get() {
      throw new Error("must not serialize");
    },
  });
  observe(input);
  observe(req(tags[1]));
  const output = JSON.stringify(log.mock.calls);
  for (const sensitive of [
    secret,
    "127.0.0.1",
    "192.0.2.1",
    "PRIVATE_COOKIE_TOKEN",
    "PRIVATE_CREDENTIAL",
  ])
    expect(output).not.toContain(sensitive);
});
it("isolates unexpected getters and disables further observations without error output", () => {
  const log = logger();
  const errorLog = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);
  const observe = createProxyObserver(config());
  const input = req();
  Object.defineProperty(input, "ip", {
    get() {
      throw new Error("PRIVATE_STACK_URI");
    },
  });
  expect(() => observe(input)).not.toThrow();
  observe(req(tags[1]));
  expect(log).not.toHaveBeenCalled();
  expect(errorLog).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
it("a logger exception cannot escape or cause unbounded retries", () => {
  const log = logger().mockImplementation(() => {
    throw new Error("PRIVATE");
  });
  const observe = createProxyObserver(config());
  expect(() => observe(req())).not.toThrow();
  observe(req(tags[1]));
  expect(log).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

it("invalid authentication does not inspect identity fields or disable a later valid probe", () => {
  const log = logger();
  const observe = createProxyObserver(config());
  const input = req(tags[0], "cd".repeat(32));
  Object.defineProperty(input, "ip", {
    get() {
      throw new Error("PRIVATE");
    },
  });
  observe(input);
  observe(req());
  expect(log).toHaveBeenCalledTimes(1);
});
it("configuration exceptions fail closed without escaping app construction", () => {
  const log = logger();
  const source = new Proxy(
    {},
    {
      get() {
        throw new Error("PRIVATE_CONFIG");
      },
    },
  );
  expect(() => createProxyObserver(source)(req())).not.toThrow();
  expect(log).not.toHaveBeenCalled();
});
it("rechecks expiry after inspecting identity fields", () => {
  const log = logger();
  const observe = createProxyObserver(config());
  const input = req();
  Object.defineProperty(input, "ip", {
    get() {
      vi.setSystemTime(epoch + 900001);
      return "127.0.0.1";
    },
  });
  observe(input);
  expect(log).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
it("normalizes candidate IPv6 limiter subnets without printing addresses", () => {
  const log = logger();
  const observe = createProxyObserver(config());
  observe(req(tags[0], secret, "2001:db8:abcd:1::1"));
  observe(req(tags[1], secret, "2001:db8:abcd:2::2"));
  expect(
    JSON.parse(log.mock.calls[1]![0]).comparisons[0].xff_first_key_equal,
  ).toBe(true);
  expect(JSON.stringify(log.mock.calls)).not.toContain("2001:");
});
it("retains only keyed snapshots, not mutable requests", () => {
  const log = logger();
  const observe = createProxyObserver(config());
  const input = req();
  observe(input);
  input.headers["x-forwarded-for"] = "198.51.100.2";
  observe(req(tags[1]));
  expect(
    JSON.parse(log.mock.calls[1]![0]).comparisons[0].xff_first_key_equal,
  ).toBe(true);
});
it("allows only eight process-local cases and does not renew absolute expiry after recreation", () => {
  const log = logger();
  const first = createProxyObserver(config());
  for (const tag of tags) first(req(tag));
  vi.setSystemTime(epoch + 900000);
  createProxyObserver(config())(req());
  expect(log).toHaveBeenCalledTimes(8);
});

it("bounds every emitted chain comparison and normalizes right-aligned positions", () => {
  const log = logger();
  const observe = createProxyObserver(config());
  const chain = Array.from({ length: 8 }, (_, i) => `192.0.2.${i + 1}`).join(
    ", ",
  );
  for (const tag of tags) observe(req(tag, secret, chain));
  const last = JSON.parse(log.mock.calls[7]![0]);
  expect(last.xff_count).toBe(8);
  expect(last.comparisons).toHaveLength(7);
  for (const comparison of last.comparisons)
    expect(comparison.xff_from_right_keys_equal).toEqual(Array(8).fill(true));
});
it("rejects array or invalid single-address candidate fields before reserving a tag", () => {
  const log = logger();
  const observe = createProxyObserver(config());
  for (const value of [["192.0.2.1"], "PRIVATE", "192.0.2.1, 192.0.2.2"]) {
    const input = req();
    input.headers["x-real-ip"] = value;
    observe(input);
  }
  observe(req());
  expect(log).toHaveBeenCalledTimes(1);
});
it("an earlier wall-clock deadline fails closed without waiting for the timer", () => {
  const log = logger();
  const observe = createProxyObserver(config());
  vi.setSystemTime(epoch + 900000);
  observe(req());
  expect(log).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
