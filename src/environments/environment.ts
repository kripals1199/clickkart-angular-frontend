/**
 * Every request goes to the API Gateway, because that is the platform's only internet-facing
 * component. The per-service ports (8081 auth, 8087 product, ...) exist for debugging and are
 * listed in the platform README, but calling them from here would bypass the Gateway's JWT
 * pre-check and its Redis-backed rate limiting - a path no real client takes.
 */
/**
 * https, because the Gateway now terminates TLS. The development certificate is self-signed, so
 * the browser will refuse the first call until you visit https://localhost:8080 once and accept
 * the warning - and it fails in a way that is easy to misread: the request never reaches the
 * server, so the console shows a generic network error rather than a certificate complaint.
 */
export const environment = {
  production: false,
  gatewayUrl: 'http://localhost:8080',
};
