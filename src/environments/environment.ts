/**
 * Every request goes to the API Gateway, because that is the platform's only internet-facing
 * component. The per-service ports (8081 auth, 8087 product, ...) exist for debugging and are
 * listed in the platform README, but calling them from here would bypass the Gateway's JWT
 * pre-check and its Redis-backed rate limiting - a path no real client takes.
 */
export const environment = {
  production: false,
  gatewayUrl: 'http://localhost:8080',
};
