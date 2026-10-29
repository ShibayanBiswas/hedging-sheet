/** The only collections the desk keeps: reference data, one document per month. */
export const COLLECTIONS = {
  volSurfaces: "vol_surfaces",
  pricingParams: "pricing_params",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

/** Months of reference data kept; older months are no longer priced against. */
export const RETENTION_MONTHS = 24;
