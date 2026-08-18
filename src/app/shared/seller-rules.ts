import { ProductStatus } from '@core/models/catalog.model';
import { FulfilmentStatus } from '@core/models/order.model';
import { StatusTone } from '@shared/order-status';

export function describeProductStatus(status: ProductStatus): { label: string; tone: StatusTone; hint: string } {
  switch (status) {
    case 'DRAFT':
      return {
        label: 'Draft',
        tone: 'neutral',
        hint: 'Only you can see this. Submit it for review to put it on sale.',
      };
    case 'PENDING_REVIEW':
      return {
        label: 'In review',
        tone: 'pending',
        hint: 'Waiting on moderation. It cannot be edited until a decision is made.',
      };
    case 'ACTIVE':
      return { label: 'On sale', tone: 'good', hint: 'Live in the catalog and buyable.' };
    case 'ARCHIVED':
      return {
        label: 'Archived',
        tone: 'neutral',
        hint: 'Withdrawn from sale. Past orders still reference it, so it is kept rather than deleted.',
      };
  }
}

/**
 * A listing is freely editable only before it has been handed to moderation. Editing something
 * mid-review would mean approving one thing and publishing another, so the server refuses it.
 */
export function isEditable(status: ProductStatus): boolean {
  return status === 'DRAFT';
}

/** Only a draft can be submitted; everything else has already been through, or is in, review. */
export function isSubmittable(status: ProductStatus): boolean {
  return status === 'DRAFT';
}

/** Archiving withdraws something from sale, so there has to be something on sale to withdraw. */
export function isArchivable(status: ProductStatus): boolean {
  return status === 'ACTIVE' || status === 'DRAFT';
}

/**
 * Mirrors {@code FulfilmentStatus.canAdvanceTo} on the server: fulfilment only moves forwards, and
 * never out of a terminal state. Duplicated here so the UI can grey out the impossible options
 * rather than offering a dropdown whose choices mostly 409 - the server remains the authority.
 */
export function nextFulfilmentOptions(current: FulfilmentStatus): FulfilmentStatus[] {
  const forward: FulfilmentStatus[] = ['PACKED', 'SHIPPED', 'DELIVERED'];

  if (current === 'CANCELLED' || current === 'DELIVERED') {
    return [];
  }

  const order: FulfilmentStatus[] = ['PENDING', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
  const currentIndex = order.indexOf(current);

  return forward.filter((candidate) => order.indexOf(candidate) > currentIndex);
}
