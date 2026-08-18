import { ProductStatus } from '@core/models/catalog.model';
import { FulfilmentStatus } from '@core/models/order.model';
import {
  describeProductStatus,
  isArchivable,
  isEditable,
  isSubmittable,
  nextFulfilmentOptions,
} from './seller-rules';

/**
 * `nextFulfilmentOptions` is a deliberate duplicate of `FulfilmentStatus.canAdvanceTo` on the
 * server, kept so the UI can grey out impossible choices instead of offering a dropdown that mostly
 * 409s. A duplicate of someone else's rule is exactly the thing that drifts silently, so it is
 * pinned here.
 */
describe('seller rules', () => {
  const allProductStatuses: ProductStatus[] = ['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'ARCHIVED'];

  describe('fulfilment transitions', () => {
    it('only ever moves forwards', () => {
      expect(nextFulfilmentOptions('PENDING')).toEqual(['PACKED', 'SHIPPED', 'DELIVERED']);
      expect(nextFulfilmentOptions('PACKED')).toEqual(['SHIPPED', 'DELIVERED']);
      expect(nextFulfilmentOptions('SHIPPED')).toEqual(['DELIVERED']);
    });

    it('offers nothing from a terminal state', () => {
      // The server refuses both, so offering either would be offering a guaranteed rejection.
      expect(nextFulfilmentOptions('DELIVERED')).toEqual([]);
      expect(nextFulfilmentOptions('CANCELLED')).toEqual([]);
    });

    it('never offers PENDING or CANCELLED as a destination', () => {
      const states: FulfilmentStatus[] = ['PENDING', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
      for (const state of states) {
        const options = nextFulfilmentOptions(state);
        expect(options).not.toContain('PENDING');
        expect(options).not.toContain('CANCELLED');
      }
    });
  });

  describe('listing lifecycle', () => {
    it('only lets a draft be edited or submitted', () => {
      expect(isEditable('DRAFT')).toBe(true);
      expect(isSubmittable('DRAFT')).toBe(true);

      // In particular, not while it is in review: approving one thing and publishing another is
      // the hole this closes.
      for (const status of allProductStatuses.filter((s) => s !== 'DRAFT')) {
        expect(isEditable(status)).toBe(false);
        expect(isSubmittable(status)).toBe(false);
      }
    });

    it('only lets something on sale, or not yet submitted, be archived', () => {
      expect(isArchivable('ACTIVE')).toBe(true);
      expect(isArchivable('DRAFT')).toBe(true);
      expect(isArchivable('PENDING_REVIEW')).toBe(false);
      expect(isArchivable('ARCHIVED')).toBe(false);
    });

    it('describes every product status, so none renders blank', () => {
      for (const status of allProductStatuses) {
        const described = describeProductStatus(status);
        expect(described.label.length).toBeGreaterThan(0);
        expect(described.hint.length).toBeGreaterThan(0);
      }
    });
  });
});
