declare module "depay-web3-mock" {
  export function mock(config: {
    blockchain: "ethereum"
    call?: {
      to: string
      api: PlainObject
      method: string
      params?: unknown
      return: unknown
    }
    transaction?: {
      to: string
      api: PlainObject
      method: string
      params?: unknown
    }
    accounts?: {
      delay?: number
      return: string[]
    }
    watchAsset?: {
      params: {
        type: string
        options: {
          address: string
          symbol: string
          decimals: number
          image: string
        }
      }
      return: boolean
    }
  }): (...args: unknown[]) => unknown

  export function resetMocks(): void
}
