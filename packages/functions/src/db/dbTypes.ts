export type Agreement = {
  // User's wallet address
  address: string
  fullName: string
  // Pool address for which they signed the agreement
  pool: string
  // Unix timestamp when they signed (includes miliseconds)
  signedAt: number
  email?: string
}
