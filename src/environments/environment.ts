/**
 * Every request goes to the API Gateway, because that is the platform's only internet-facing
 * component. The per-service ports (8081 auth, 8087 product, ...) exist for debugging and are
 * listed in the platform README, but calling them from here would bypass the Gateway's JWT
 * pre-check and its Redis-backed rate limiting - a path no real client takes.
 *
 * <p>http, not https. The Gateway can terminate TLS but does not by default: its config sets
 * server.ssl.enabled=${TLS_ENABLED:false}, so a fresh checkout serves plain HTTP and this has to
 * match it. A mismatch fails before the request leaves the browser.
 *
 * <p>To develop against TLS instead, run scripts/generate-dev-tls.sh, start the Gateway with
 * TLS_ENABLED=true, and change this to https. The development certificate is self-signed, so the
 * browser refuses the first call until you visit https://localhost:8080 once and accept the
 * warning - and it fails in a way that is easy to misread, because the request never reaches the
 * server and the console shows a generic network error rather than a certificate complaint.
 *
 * <p>ALLOWED_ORIGINS on the Gateway stays http://localhost:4200 either way. That is this app's
 * origin, not the Gateway's, and switching the Gateway to TLS does not change where the SPA is
 * served from.
 */
export const environment = {
  production: false,
  gatewayUrl: 'http://localhost:8080',
};
