export type UserWalletWeb3Status =
  | {
      type: "no_web3"
      networkName: undefined
      address: undefined
    }
  | {
      type: "has_web3"
      networkName: string
      address: undefined
    }
  | {
      type: "connected"
      networkName: string
      address: string
    }

/**
 * Utility type for distinguishing between values of some type `T` in terms of the
 * Web3 provider to which they relate. The `readOnly` provider should be preferred
 * for read-only queries, as its resources are dedicated to Goldfinch. (This
 * preference is a general principle but not absolute; for example, for some read query
 * that immediately precedes sending a transaction to obtain an input to the transaction,
 * you might prefer to use the `userWallet` provider.) The `userWallet` provider must be
 * used for sending transactions, as only this value of `T` is capable of receiving user
 * input via the user's wallet.
 */
export type Web3IO<T> = {
  readOnly: T
  userWallet: T
}
