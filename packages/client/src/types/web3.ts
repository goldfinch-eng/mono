export type Web3Status =
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
