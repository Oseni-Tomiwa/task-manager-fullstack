# TaskFlow — Phase 5.3.3 temporary proxy observer

Local implementation and verification only. No production connection, production secret generation/activation, environment change, database operation, deployment or Git mutation was performed. The production trust boundary is still unverified; this observer does not fix identity or change the authentication limiter.

## Design and configuration (not activated)

`server/src/diagnostics/proxy-observer.ts` creates one observer per Express app. The existing GET `/api/health` handler calls it before returning the unchanged 200 `{"status":"ok"}` response with no-store/Helmet headers. There is no new route or diagnostic response header. Failed/expired/disabled/duplicate/malformed probes receive the same normal health response; the endpoint does not disclose authentication success, remaining budget or expiry.

The observer is off unless all three process-start configuration values are valid:

| Name                        | Required value                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PROXY_OBSERVER_ENABLED`    | Exactly `1`; unset/other values disable it. Independent of `STARTUP_DIAGNOSTICS`.                                                                 |
| `PROXY_OBSERVER_SECRET`     | A fresh, privately generated 32-random-byte secret represented as exactly 64 hexadecimal characters. Do not reuse JWT/database credentials.       |
| `PROXY_OBSERVER_EXPIRES_AT` | Absolute ISO UTC timestamp in `YYYY-MM-DDTHH:mm:ss.sssZ` form; it must be in the future and no more than 15 minutes away when the app is created. |

Only for a separately approved run, generate the gate in an owner-approved cryptographically secure secret manager, configure it privately and pass the exact value in `X-TaskFlow-Observer-Key`. Never generate it into terminal output, commit it, put it in a URL/query string, copy it into a browser console transcript or retain a HAR. The observer can validate format, not prove a secret's entropy. No real secret or enabling entry was added to an example environment file or deployment config.

The gate stores only a SHA-256 digest, compares a bounded supplied secret using constant-time digest comparison, and checks it before inspecting identities. Wrong/missing/duplicate/oversized gates do not consume cases. `X-TaskFlow-Observer-Probe` must be one of the eight fixed tags below; each accepted tag can be used only once per observer. Invalid tags, duplicate cases and rejected forwarding inputs emit nothing and do not consume budget. An exception disables the observer; a failed output cannot be retried to exceed the cap.

An absolute deadline plus a monotonic deadline prevents clock rollback from extending the lifetime. An unreferenced timer clears comparison state even without further traffic. Before emitting, expiry is checked again. Cap, expiry or unexpected exception erases the retained buffers and disables further observations. Configuration failures fail closed without preventing app creation.

## Important cap and Render Free limitations

**At most eight observations are enforced per app/process, not across a deployment.** A restart, redeploy or second replica can create a new eight-case budget while the same absolute expiry is still in the future. The expiry itself does not renew on restart. Process-private digests and salts cannot be compared across instances. This is an unavoidable limitation of the approved in-memory/no-shared-state design; there is no deployment-wide at-most-eight guarantee.

**Do not activate this implementation if a deployment-wide cap is mandatory.** That requirement would need separately approved shared replay/budget state or a different operational design. No database command, shared service, filesystem replay store or infrastructure change was added. For a single-process trial, the owner must explicitly accept the process-local cap, ensure a single instance, abort on any restart or interleaved replica evidence, and remove/disable the configuration before attempting another run. Do not silently merge records across process lifetimes.

Render Free cold starts/restarts and deployments may shorten the usable absolute window or interrupt it. Expired or invalid configuration remains silent. Health must continue working after expiry/cap; absence of events is not proof that the key, forwarding format or process is correct. A cold start that outlasts the deadline requires a new separately approved run, not expiry extension inside the observer. No keep-alive or service restart was added.

## Privacy and bounded inspection

Only socket peer, Express `req.ip`, X-Forwarded-For, X-Real-IP and X-Vercel-Forwarded-For are inspected. Cookie, Authorization, Host, Origin, request bodies and arbitrary object properties are not logged or serialized. The request's existing `req.ip` behavior is preserved; default proxy trust remains false.

Forwarded-for input is capped at 512 characters and eight entries; each address is a bare IPv4/IPv6 value of at most 64 characters. Ports, brackets, zone identifiers, empty elements, invalid IPs and repeated array-valued fields are rejected. Single-address candidate headers must contain exactly one valid address. Missing candidate headers are allowed and compare as `null`, not equal. Oversized/nonstandard legitimate chains can therefore produce no event; do not interpret silence as safe sanitization or weaken parsing to obtain output.

Raw addresses are used transiently within one synchronous invocation. The only retained identity representations are HMAC digests using a fresh random 32-byte process-private comparison key. No digest/key/address is emitted. Candidate/current identities use the installed limiter's normal IPv6 /56 normalization; socket comparisons use exact canonical addresses. A subnet-key equality is not necessarily exact-IP equality. At most eight snapshots exist. Only derived gate material enters the observer closure; it does not retain the source environment object. The environment itself still holds any owner-configured secret until removed by the owner/platform. Buffer erasure is best effort; JavaScript/runtime memory copies cannot be guaranteed forensically erased.

Each event contains a fixed event name, one allowlisted probe tag, bounded XFF entry count and comparisons against earlier accepted tags:

- `socket_equal`: canonical socket addresses equal.
- `current_key_equal`: existing limiter identities equal, including IPv6 normalization.
- `xff_first_key_equal`, `xff_last_key_equal`, `real_key_equal`, `vercel_key_equal`: corresponding proposed candidate keys equal.
- `xff_from_right_keys_equal`: at most eight booleans/nulls, comparing each XFF position from the right (index zero is the rightmost header entry). It does not assert which hop is trusted.

Comparison values are `true`, `false` or `null` for missing data. First event has no comparisons. No timings, process IDs, request IDs, network labels beyond the fixed tags, IP strings, fingerprints, secret values, header contents or exceptions are emitted. The only counts are bounded chain lengths; the number of comparison objects is at most seven.

Example synthetic event, not production evidence:

```json
{
  "event": "proxy_observation",
  "probe": "a_direct_spoof",
  "xff_count": 1,
  "comparisons": [
    {
      "probe": "a_direct_base",
      "socket_equal": true,
      "current_key_equal": true,
      "xff_first_key_equal": false,
      "xff_last_key_equal": false,
      "real_key_equal": true,
      "vercel_key_equal": true,
      "xff_from_right_keys_equal": [false]
    }
  ]
}
```

## Authorized eight-observation matrix (prepared, NOT executed)

Separate authorization must cover deployment of this exact reviewed code, private configuration/activation for one specified window, the process-local cap limitation, the two controlled public networks, eight requests and disabling/removal afterward. Local implementation approval does not grant those permissions. Use two distinct known egress networks (not two devices behind the same NAT or IPv6 /56); confirm expected identity separation privately. Tags are operator assertions, not cryptographic proof of route/network provenance.

Use credential-free GET requests to `/api/health` only. Send only the private gate and tag for a baseline. In a spoof case additionally supply the same fixed synthetic header values on both networks/paths: XFF `192.0.2.10, 198.51.100.20`, X-Real-IP `203.0.113.30`, X-Vercel-Forwarded-For `192.0.2.40` (reserved documentation addresses, not real clients). No cookies/Authorization or account requests are needed. An owner-approved client must keep the gate in memory/private storage and print only sanitized evidence, not full request/response headers. Do not use arbitrary URL/query tags, save command history containing a secret, or export network traces containing the gate.

| Order | Fixed tag        | Network | URL host                                      | Forwarding supplied by operator |
| ----- | ---------------- | ------- | --------------------------------------------- | ------------------------------- |
| 1     | `a_direct_base`  | A       | `task-manager-fullstack-4wf9.onrender.com`    | None                            |
| 2     | `a_direct_spoof` | A       | Render                                        | Synthetic values above          |
| 3     | `a_proxy_base`   | A       | `task-manager-fullstack-vert-five.vercel.app` | None                            |
| 4     | `a_proxy_spoof`  | A       | Vercel                                        | Synthetic values above          |
| 5     | `b_direct_base`  | B       | Render                                        | None                            |
| 6     | `b_direct_spoof` | B       | Render                                        | Synthetic values above          |
| 7     | `b_proxy_base`   | B       | Vercel                                        | None                            |
| 8     | `b_proxy_spoof`  | B       | Vercel                                        | Synthetic values above          |

Do not reuse a tag to replace an accepted case. Rejects do not consume the server-side budget, but retries require owner review to avoid mixing runs/instances. Stop on restart, replica ambiguity, missing events, malformed/nonstandard chains or unexpected health behavior. Never run authentication-limit exhaustion, credential attempts or production writes. After case eight, the observer destroys its state; the owner still removes/disables the private configuration as defense in depth.

## Interpretation

1. Compare A/B baseline records on each path. Equal current keys demonstrate aggregation for those observations; distinct keys disprove aggregation only for those samples, not all future ingress/load-balancer behavior. Compare socket equality separately. Equal keys are not account/session equivalence.
2. Within each network/path, compare baseline against spoof. A changed candidate key shows that candidate is not stable against the supplied input on that path. An unchanged key is necessary but not sufficient evidence of trusted sanitization. Only a provider-supported boundary plus the observed full-path behavior can justify a trust rule.
3. Compare XFF counts and right-aligned positions across direct/proxied cases. Different path lengths rule out assuming a uniform hop count. Do not infer a trusted proxy's network range from an equality boolean or infer that rightmost always means real visitor.
4. Since both spoof runs deliberately submit identical marker values, equality of candidate keys across network A/B spoof cases can reveal caller-controlled grouping even when baseline identities differed. It is not independently authenticated provenance.
5. Existing trust false should make changes to forwarding values alone unable to change `req.ip`; observed differences may instead reflect socket/ingress selection. This observer provides comparisons, not a unique causal diagnosis.
6. No output validates a secret-authenticated Vercel boundary: the observer gate proves only that the operator knew the gate. Direct Render remains public. It must not become an authentication bypass or production limiter key source.

The observer does not know the networks' expected public IPs and intentionally cannot print them. It cannot alone prove that a candidate equals the actual visitor; the owner must combine controlled network knowledge, repeatable comparisons and authoritative provider guarantees. No proxy trust, rate-limit key or security policy change is approved by an apparently favorable matrix.

## Meaningful added risk and review

Disabled mode installs a no-op on health and creates no timers/comparison state. Enabled mode adds bounded parsing, hashing and equality work on health; unauthorized gate attempts are silent but can still incur bounded hashing work. No new network request, MongoDB command, auth/CSRF change or unrestricted debug logger is added. The event volume is capped in one process, but repeated restarts/replicas are the explicit exception above. Native health checks without gate are unaffected and consume no cases.

The gate travels through Vercel/Render in a header; application code never logs it, but provider/client tracing or operator tooling could capture it. Before activation, the owner must ensure those tools do not collect sensitive headers and limit access to comparison logs. Equality relationships reveal coarse linkage between controlled probes, so probe only consenting controlled networks. Synchronous console output may briefly block; at most eight short fixed-shape events are generated per process. Unexpected observer/config/logger exceptions fail closed without going to the generic error middleware or printing raw errors.

## Verification and review handoff

Final local results:

| Check                          | Result                                                                                                                                                                                                                           |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Observer unit tests            | 29 passed: disabled/invalid config, strict UTC/15-minute bounds, gates, non-consuming rejection, unique tags/cap, expiry/rollback, bounded input/output, IPv6 normalization, missing fields, no leakage and exception isolation. |
| Observer HTTP health tests     | 3 passed: unchanged health/status/security/cache headers, no reflected diagnostic fields, no new route, logger-error isolation and unchanged proxy trust.                                                                        |
| Full backend regression        | 265/265 passed across 17 files, including the 32 new tests. Database boundaries are mocked/in-memory.                                                                                                                            |
| Full frontend regression       | 39/39 passed across five files; frontend source unchanged.                                                                                                                                                                       |
| TypeScript, ESLint, formatting | Passed for both applications. An intermediate lint finding about an unused reference-clearing assignment was corrected by isolating settings derivation from the request closure, then all server checks reran successfully.     |
| Production builds              | Client TypeScript plus Vite build and final server TypeScript build passed.                                                                                                                                                      |
| Documentation/whitespace       | Prettier checks and `git diff --check` passed.                                                                                                                                                                                   |

All checks used installed tools without dependency/lockfile changes. No real-database integration test was run because this milestone forbids database changes. No production connection, network probe, activation or deployed behavior is claimed. Repeated final backend checks followed concrete expiry/input/closure hardening changes, not attempts to hide a failing result.

Changed-file inventory:

- Modified: `server/src/app.ts` (observer creation/import and health-only invocation).
- Added: `server/src/diagnostics/proxy-observer.ts`.
- Added: `server/tests/proxy-observer.test.ts` and `server/tests/proxy-observer-health.test.ts`.
- Added: this report and `docs/superpowers/plans/2026-11-05-proxy-observer.md`.

The pre-existing `.pnpm-store/` remains untouched/untracked. No environment, deployment, proxy-trust, limiter-key or database configuration file changed.

After review, the owner may run these Git commands from the repository root; none were executed by the agent:

```sh
git status --short --branch
git diff --check
git diff -- server/src/app.ts
# Read all five new files listed above before staging.
git add -- server/src/app.ts server/src/diagnostics/proxy-observer.ts server/tests/proxy-observer.test.ts server/tests/proxy-observer-health.test.ts docs/phase-5.3.3-proxy-observer.md docs/superpowers/plans/2026-11-05-proxy-observer.md
git diff --cached --check
git diff --cached --stat
git diff --cached
# Confirm exactly the six reviewed files; exclude unrelated files and secrets.
git commit -m "chore(server): add gated temporary proxy identity observer"
git status --short --branch
```

Push, deployment and activation require separate owner decisions. Staging/committing this code does not activate it; environment configuration is deliberately absent.

For removal after the approved run: disable/remove all three environment values through a separately authorized owner workflow, remove the observer call/import and factory creation from `server/src/app.ts`, then remove the helper and dedicated tests and rerun regression checks. Preserve the sanitized conclusions, not raw diagnostic traffic or keys. Do not remove existing startup diagnostics or modify authentication as an unrelated cleanup.

Review focus: fixed case protocol, strict expiry, fail-closed behavior, bounded memory/input/output, no secret reflection, and acceptance of the process-local budget limitation. The existing release blocker remains until the production evidence is collected and an exact policy is separately approved.
