/**
 * All app data lives under this fixed Firestore path so every device
 * (laptop, phone, tablet) sees the same organizations, donors, and donations.
 * Anonymous Firebase Auth still runs for security rules, but we do not use auth.uid
 * as the data path (each browser would get a different uid otherwise).
 */
export const SHARED_WORKSPACE_ID = 'laf_shared_workspace';

export const DATA_COLLECTIONS = ['organizations', 'donors', 'donations'] as const;
export type DataCollectionName = (typeof DATA_COLLECTIONS)[number];
