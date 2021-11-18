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
    accounts?: {
      delay?: number
      return: string[]
    }
  }): (...args: unknown[]) => unknown

  export function resetMocks(): void
}
