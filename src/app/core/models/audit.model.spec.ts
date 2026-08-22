import { AUDIT_SOURCES } from './audit.model';

/**
 * The registry exists because the platform is not uniform: Auth Service spells its verification
 * endpoint "/audit/verify" and every other service spells it "/audit/verification". That looks like
 * an inconsistency somebody would helpfully "tidy up" into one shape, which would 404 half the
 * console - so it is pinned here.
 */
describe('audit sources', () => {
  it('keeps auth on /audit/verify', () => {
    const auth = AUDIT_SOURCES.find((s) => s.key === 'auth');
    expect(auth).toBeDefined();
    expect(auth!.base).toBe('/api/v1/auth');
    expect(auth!.verifyPath).toBe('/audit/verify');
  });

  it('keeps every other service on /audit/verification', () => {
    for (const source of AUDIT_SOURCES.filter((s) => s.key !== 'auth')) {
      expect(source.verifyPath).toBe('/audit/verification');
    }
  });

  it('covers all seven chains, each with a distinct base', () => {
    expect(AUDIT_SOURCES).toHaveLength(7);

    const bases = AUDIT_SOURCES.map((s) => s.base);
    expect(new Set(bases).size).toBe(7);

    const keys = AUDIT_SOURCES.map((s) => s.key).sort();
    expect(keys).toEqual(['auth', 'category', 'inventory', 'order', 'payment', 'product', 'user']);
  });

  it('gives every source a label and an /api/v1 base', () => {
    for (const source of AUDIT_SOURCES) {
      expect(source.label.length).toBeGreaterThan(0);
      expect(source.base.startsWith('/api/v1/')).toBe(true);
    }
  });
});
