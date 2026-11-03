type Stage = "app" | "database_connect" | "user_init" | "http_bind";
type Classification = { category: string; code?: string | number };

const codes = new Map<string | number, string>([
  [18, "authentication"],
  [13, "authorization"],
  [11000, "duplicate_key"],
  [85, "index_conflict"],
  [86, "index_conflict"],
  ...["ENOTFOUND", "EAI_AGAIN", "ENODATA", "ESERVFAIL"].map(
    (code) => [code, "dns"] as const,
  ),
  ...[
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "ENETUNREACH",
    "EHOSTUNREACH",
  ].map((code) => [code, "network"] as const),
  ...[
    "CERT_HAS_EXPIRED",
    "CERT_NOT_YET_VALID",
    "DEPTH_ZERO_SELF_SIGNED_CERT",
    "SELF_SIGNED_CERT_IN_CHAIN",
    "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
    "ERR_TLS_CERT_ALTNAME_INVALID",
  ].map((code) => [code, "tls"] as const),
]);

// Only known paths are inspected. Never enumerate properties or serialize errors.
function read(value: unknown, key: string): unknown {
  try {
    return value && typeof value === "object"
      ? Reflect.get(value, key)
      : undefined;
  } catch {
    return undefined;
  }
}
function classify(stage: Stage, error: unknown): Classification {
  if (stage === "http_bind") {
    const code = read(error, "code");
    return {
      category: "http_binding",
      ...([
        "EADDRINUSE",
        "EADDRNOTAVAIL",
        "EACCES",
        "ENOTFOUND",
        "EAI_AGAIN",
      ].includes(typeof code === "string" ? code : "")
        ? { code: code as string }
        : {}),
    };
  }
  let fallback = "unknown";
  const queue = [{ value: error, depth: 0 }];
  const seen = new Set<unknown>();
  for (let i = 0; i < queue.length && i < 32; i++) {
    const { value, depth } = queue[i]!;
    if (!value || typeof value !== "object" || seen.has(value)) continue;
    seen.add(value);
    const code = read(value, "code");
    if (typeof code === "string" || typeof code === "number") {
      const category = codes.get(code);
      if (category) return { category, code };
    }
    const codeName = read(value, "codeName");
    if (codeName === "AuthenticationFailed")
      return { category: "authentication", code: 18 };
    if (codeName === "Unauthorized")
      return { category: "authorization", code: 13 };
    const name = read(value, "name");
    if (name === "MongoParseError" || name === "MongoInvalidArgumentError")
      fallback = "connection_configuration";
    else if (
      fallback === "unknown" &&
      (name === "MongoServerSelectionError" ||
        name === "MongooseServerSelectionError")
    )
      fallback = "server_selection_unknown";
    if (depth >= 6) continue;
    queue.push({ value: read(value, "cause"), depth: depth + 1 });
    const servers = read(read(value, "reason"), "servers");
    try {
      // Use native Map operations: no user-provided iterator or hostname keys.
      const iterator = Map.prototype.values.call(
        servers,
      ) as MapIterator<unknown>;
      for (let n = 0; n < 8 && queue.length < 32; n++) {
        const entry = iterator.next();
        if (entry.done) break;
        queue.push({ value: read(entry.value, "error"), depth: depth + 1 });
      }
    } catch {
      /* Not a native Map. */
    }
  }
  return { category: fallback };
}
function emit(stage: Stage, result: "ok" | "failed", error?: unknown) {
  if (process.env.STARTUP_DIAGNOSTICS !== "1") return;
  try {
    console.info(
      JSON.stringify({
        event: "startup_diagnostic",
        stage,
        result,
        ...(result === "failed" ? classify(stage, error) : {}),
      }),
    );
  } catch {
    /* Diagnostics must not affect startup or cleanup. */
  }
}

export async function diagnoseStartup<T>(
  stage: Exclude<Stage, "app">,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    const result = await operation();
    emit(stage, "ok");
    return result;
  } catch (error) {
    emit(stage, "failed", error);
    throw error;
  }
}

export function diagnoseApp<T>(operation: () => T): T {
  try {
    const result = operation();
    emit("app", "ok");
    return result;
  } catch (error) {
    emit("app", "failed", error);
    throw error;
  }
}
