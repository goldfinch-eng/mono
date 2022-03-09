export const ALLOWED_CHAIN_IDS =
  process.env.NODE_ENV === "production" ? [1] : [1, 3, 4, 31337];
