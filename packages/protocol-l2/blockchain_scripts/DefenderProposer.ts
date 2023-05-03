import {assertNonNullable} from "@goldfinch-eng/utils"
import {AdminClient} from "defender-admin-client"
import {ChainId, ChainName, CHAIN_NAME_BY_ID, SAFE_CONFIG} from "./deployHelpers"

const DEFENDER_API_KEY = process.env.DEFENDER_API_KEY
const DEFENDER_API_SECRET = process.env.DEFENDER_API_SECRET

function getDefenderClient() {
  assertNonNullable(DEFENDER_API_KEY, "DEFENDER_API_KEY is null. It must be set as an envvar")
  assertNonNullable(DEFENDER_API_SECRET, "DEFENDER_API_SECRET is null. It must be set as an envvar")
  return new AdminClient({apiKey: DEFENDER_API_KEY, apiSecret: DEFENDER_API_SECRET})
}

export default abstract class DefenderProposer {
  hre: any
  logger: typeof console.log
  chainId: ChainId
  network: ChainName
  client: AdminClient
  safeAddress: string

  constructor({hre, logger, chainId}) {
    this.hre = hre
    this.logger = logger
    this.chainId = chainId
    this.network = CHAIN_NAME_BY_ID[chainId]
    this.client = getDefenderClient()
    const safe = SAFE_CONFIG[chainId]
    if (!safe) {
      throw new Error(`No safe address found for chain id: ${chainId}`)
    } else {
      this.safeAddress = safe.safeAddress
    }
  }

  defenderUrl(contractAddress: string): string {
    return `https://defender.openzeppelin.com/#/admin/contracts/${this.network}-${contractAddress}`
  }
}
