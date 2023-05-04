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

export type DestroyedUserInfo = {
  burnedUidType: string
  countryCode: string
  deletedAt: number
  persona: {
    // Inquiry id
    id: string
    status: string
  }
}

export type DestroyedUser = {
  address: string
  deletions: DestroyedUserInfo[]
}
