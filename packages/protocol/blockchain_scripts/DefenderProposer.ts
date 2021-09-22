import {AdminClient} from "defender-admin-client"
import {ChainId, ChainName, CHAIN_NAME_BY_ID, getDefenderClient, SAFE_CONFIG} from "./deployHelpers"

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
