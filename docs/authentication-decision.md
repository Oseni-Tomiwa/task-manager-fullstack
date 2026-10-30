# Authentication architecture review — Phase 2

Status: cookie authentication implemented in Phase 3.3; live database and hosting/proxy integration remain unverified. See [the implemented contract](phase-3.3-authentication.md). Historical options and recommendations follow. This note evaluates a change to the Phase 1 memory-only JWT proposal; it does not imply production approval.

## Options and recommendation

The simplest baseline remains the approved short-lived in-memory bearer JWT: no browser storage, no automatic cookie credential transport, but reload requires login and logout cannot revoke a copied token. For a smoother reload experience, recommend a short-lived JWT in a host-only HttpOnly cookie, accessed through a same-origin `/api` reverse proxy on Vercel to the Render backend. This retains the requested JWT stack and needs no refresh-token service, Redis or separate session store. Confirm proxy forwarding and Set-Cookie behavior in real browsers before adopting it. Do not implement the proxy or authentication during the prototype phase.

The browser calls its own origin, while Express still runs separately on Render. Configure the API rewrite before the SPA fallback and fix its upstream destination in deployment configuration. Use the Vite development proxy for local `/api` calls later. Do not allow clients to choose an upstream URL. Authentication responses must be non-cacheable (`Cache-Control: no-store`). Vercel preview hosts must be explicitly supported or disallowed, never broadly trusted.

## Cookie configuration

Production proposal: `__Host-taskflow=<JWT>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=1800`, no Domain attribute. HttpOnly prevents script reads; Secure restricts transmission to HTTPS; host-only scope avoids exposing credentials to sibling subdomains. Lax supports ordinary navigation while limiting cross-site cookie use. It is a defense layer, not a replacement for CSRF controls. JWT expiry and cookie lifetime both use 30 minutes, no silent renewal. Verify signature algorithm, issuer, audience, subject and expiry server-side.

For plain-HTTP local development only, use a separate unprefixed cookie name with Secure disabled and identical remaining semantics. Never relax production settings to accommodate local development. Do not put JWTs in JSON responses or localStorage when cookie transport is selected. On startup the client calls `/api/auth/me` and shows a session-loading state until it resolves.

## Cross-origin and cross-site distinction

A Vercel default host and a Render default host are different sites as well as different origins. Direct cookie requests between them generally require `SameSite=None; Secure` and `fetch(..., {credentials: 'include'})`. Browser third-party-cookie restrictions can still block that design. Setting a cookie Domain cannot bridge unrelated sites. Do not choose direct cross-site cookies as the default for this assignment.

Custom `app.example.com` and `api.example.com` hosts over HTTPS can be same-site while remaining cross-origin. Such requests still need explicit credential handling and CORS even with Lax cookies, and add domain configuration work. A same-origin proxy avoids this dependency.

## CORS, credentials and CSRF

For the recommended proxy, use relative `/api` fetch requests with `credentials: 'same-origin'`. The browser sees no cross-origin request and does not need credentialed CORS. The backend must still authenticate requests and validate their origin, including direct requests to its Render URL; CORS is not an access-control or CSRF boundary by itself.

If direct cross-origin access is later required, use an exact configured origin allowlist, `Access-Control-Allow-Credentials: true`, `Vary: Origin`, explicit methods/headers and unauthenticated OPTIONS handling. Never combine credentialed CORS with a wildcard origin or reflect arbitrary origins. Include credentials on login, current-user and logout requests as well as task requests.

For this JSON-only API, a small CSRF strategy is to require `application/json` plus a custom `X-TaskFlow-Request: 1` header on every state-changing request (POST/PATCH/DELETE), including login, registration and logout, and verify the exact trusted frontend Origin server-side. Reject missing/untrusted/null origins, absent headers and unsupported content types; exempt only non-mutating OPTIONS. JSON/header checks must run on the server, not just in CORS configuration. These controls force malicious cross-origin browser requests into preflight, which must be denied for untrusted origins. Keep GET/HEAD read-only. Configure the expected origin explicitly rather than trusting arbitrary forwarded Host headers. A session-bound CSRF token is a suitable alternative if non-JSON forms or broader client support becomes necessary; do not use a naive unsigned double-submit pattern.

HttpOnly does not stop an XSS payload from making authenticated requests. Preserve input validation, text-only rendering, security headers, ownership enforcement and careful dependency choices.

## Logout and expiration

Add `POST /api/auth/logout`, protected by the same origin/header checks. It clears the cookie using the same name, path, host and security attributes with Max-Age=0, returns 204, and clears frontend user/task state only once the logout request succeeds. On failure show retry feedback rather than claiming server logout succeeded. `/auth/register` and `/auth/login` set cookies and return only `{data:{user}}`; `/auth/me` restores user state. Missing/expired cookies return 401; the UI clears private state and redirects to login with a session-expired message.

This stateless strategy cannot invalidate an already stolen JWT on logout before its 30-minute expiry. If immediate server-side revocation becomes a requirement, add a session version/revocation mechanism or database-backed opaque sessions after explicit review. Do not claim browser cookie clearing revokes copied credentials. No refresh tokens, remember-me control or rolling sessions in the MVP.

## Approval requested

Approve whether production should retain memory-only bearer JWTs or adopt the recommended cookie JWT with same-origin proxy and header/origin CSRF defenses. If cookies are selected, update the Phase 1 endpoint contracts and deployment configuration together during the separately approved implementation phase. The prototype remains mock-only regardless of that decision.

## Sources checked October 29, 2026

- [MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie): cookie attributes, prefixes and credential handling.
- [MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS): exact origins, credentialed requests and third-party-cookie policies.
- [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html): custom request headers, strict CORS, origin validation and SameSite limitations.

## Final recommendation — October 30, 2026

Prefer the short-lived HttpOnly-cookie JWT and same-origin API proxy described above. Vercel officially supports external rewrites as reverse proxies, so the proposed split hosting can support this architecture. Reliability for TaskFlow is still conditional on deployment integration checks; it has not been demonstrated by this mock prototype.

Later configuration example (documentation only): rewrite `/api/:path*` to `https://<backend-host>/api/:path*`, preserving the Express `/api` prefix, before rewriting SPA routes to `/index.html`. Render must listen on its supplied PORT over the hosting platform's TLS ingress. Use the production frontend origin as explicit configuration; do not infer trust from an arbitrary forwarded Host header.

Before production acceptance verify: login's Set-Cookie reaches the browser on the frontend host; the cookie has HttpOnly/Secure/Lax, Path=/ and no Domain; reload restores `/auth/me`; authenticated task requests reach Render with the cookie and custom header; untrusted/missing/null Origin mutations fail; HTML-form content types and missing custom headers fail; logout clears the cookie; expired JWTs return 401 and clear private UI state; personalized responses are never CDN-cached; API rewrites do not fall through to SPA HTML. Verify cold-start loading and retry behavior as well as a normal request. Preview deployments should be denied authentication until their origins and proxy behavior are deliberately configured. No deploy or production connection is authorized by this note.

If the rewrite does not preserve required cookie/header semantics, use a small same-origin forwarding function with a fixed backend destination and explicit header/cookie forwarding, then repeat those checks. Do not silently switch to third-party `SameSite=None` cookies or weaken origin validation. An opaque database-backed session would offer immediate revocation, but adds session storage and changes the planned JWT approach; it is unnecessary unless that becomes a requirement. The current JWT recommendation deliberately accepts up to 30 minutes of stolen-token validity after browser logout.

Sources rechecked: [Vercel rewrites and external-origin proxying](https://vercel.com/docs/routing/rewrites), [OWASP CSRF custom-header and origin guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html). Cookie/CORS details remain linked above. The deployment recommendation is an engineering inference from supported proxy capabilities, not evidence of a deployed TaskFlow setup.
