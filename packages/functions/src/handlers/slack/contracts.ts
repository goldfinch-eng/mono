import {BigNumber} from "ethers"
import {ContractMetadata} from "./types"

export const EVENTS: Record<string, string> = {
  TRANSFER_FROM_TO_UINT256: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
} as const

export const METHODS: Record<string, string> = {
  TRANSFER_TO_UINT256: "0xa9059cbb",
  TRANSFER_FROM_TO_UINT256: "0x23b872dd",
  SAFE_TRANSFER_FROM_TO_UINT256: "0x42842e0e",
} as const

const usdcFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

export const CONTRACTS = {
  USDC: {
    toLabel: (amount: BigNumber) => usdcFormatter.format(amount.div(BigNumber.from(1_000_000)).toNumber()),
  },
} as const satisfies Record<string, ContractMetadata>
