export type AddressLabel = 'HOME' | 'WORK' | 'OTHER';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';

/**
 * The customer profile. Distinct from the auth account: this service owns name, preferences and
 * addresses, while Auth Service owns the credentials and roles. Nothing here identifies a login.
 */
export interface UserProfile {
  userPublicId: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  /** yyyy-MM-dd. */
  dateOfBirth: string | null;
  gender: Gender | null;
  avatarUrl: string | null;
  marketingEmailOptIn: boolean;
  marketingSmsOptIn: boolean;
  preferredLanguage: string;
  preferredCurrency: string;
  createdDate: string;
  updatedDate: string;
  /**
   * Set when personal data was erased, null while the account is live. It exists so a client can
   * tell "erased" apart from "never filled in" - both otherwise look like a profile of nulls.
   */
  erasedAt: string | null;
}

export interface UpdateProfileRequest {
  firstName: string;
  lastName: string;
  displayName: string;
  /** yyyy-MM-dd, and must be in the past. */
  dateOfBirth: string | null;
  gender: Gender | null;
  /** Must be an https URL, or empty. */
  avatarUrl: string;
}

export interface UpdatePreferencesRequest {
  marketingEmailOptIn: boolean;
  marketingSmsOptIn: boolean;
  /** ISO language tag: "en" or "en-IN". */
  preferredLanguage: string;
  /** ISO 4217, three uppercase letters. */
  preferredCurrency: string;
}

/**
 * A shipping address. `id` is a plain numeric id rather than a public id - addresses are only ever
 * addressed within the owning account's own collection.
 */
export interface Address {
  id: number;
  label: AddressLabel;
  recipientName: string;
  contactNumber: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  defaultAddress: boolean;
  createdDate: string;
  updatedDate: string;
}

export interface AddressRequest {
  label: AddressLabel;
  recipientName: string;
  /** Indian 10-digit, first digit 6-9. */
  contactNumber: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  state: string;
  /** Six digits, cannot start with 0. */
  postalCode: string;
  country: string;
  makeDefault?: boolean;
}

export type SellerVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

/**
 * A seller's business identity. Separate from the customer profile: this is the trading entity, and
 * it carries statutory retention obligations, which is why an account holding one cannot erase its
 * personal data.
 */
export interface SellerProfile {
  userPublicId: string;
  businessName: string;
  gstin: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  pickupAddressId: number | null;
  /** Decided by an operator. A seller can read this but never set it. */
  verificationStatus: SellerVerificationStatus;
  verificationNote: string | null;
  verificationDecidedAt: string | null;
  createdDate: string;
  updatedDate: string;
}

export interface UpsertSellerProfileRequest {
  businessName: string;
  /**
   * India GSTIN: 15 characters - 2-digit state code, then the PAN's 5 letters, 4 digits and 1
   * letter, an entity-number character, a literal Z, and a checksum character. Either case is
   * accepted; the server uppercases before storing.
   */
  gstin: string;
  supportEmail: string;
  /** Indian 10-digit, first digit 6-9, or empty. */
  supportPhone: string;
  /** An address id from this seller's own book, or null to nominate none. */
  pickupAddressId: number | null;
}
