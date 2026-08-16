/**
 * Swapped in for environment.ts by angular.json's production fileReplacements.
 *
 * <p>The gateway origin is intentionally left as a same-origin relative base rather than a
 * hard-coded host: in any real deployment the browser and the Gateway sit behind the same
 * ingress, so the client should ask whoever served it. Baking a hostname in here is what forces
 * a rebuild per environment, and it is also how a staging build ends up talking to production.
 */
export const environment = {
  production: true,
  gatewayUrl: '',
};
