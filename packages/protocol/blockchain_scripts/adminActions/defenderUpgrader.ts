import {HardhatRuntimeEnvironment} from "hardhat/types"

import {SAFE_CONFIG, getDefenderClient, CHAIN_NAME_BY_ID, ChainId, AddressString, ChainName} from "../deployHelpers"
import {AdminClient} from "defender-admin-client"
import {Network} from "defender-base-client"

class DefenderUpgrader {
  hre: HardhatRuntimeEnvironment
  logger: typeof console.log
  chainId: ChainId
  network: ChainName
  client: AdminClient
  safeAddress: AddressString
  goldfinchUnderwriter: string

  constructor({hre, logger, chainId}) {
    this.hre = hre
    this.logger = logger
    this.chainId = chainId
    this.network = CHAIN_NAME_BY_ID[chainId]
    this.client = getDefenderClient()
    const safe = SAFE_CONFIG[chainId]
    this.goldfinchUnderwriter = "0x79ea65C834EC137170E1aA40A42b9C80df9c0Bb4"
    if (!safe) {
      throw new Error(`No safe address found for chain id: ${chainId}`)
    } else {
      this.safeAddress = safe.safeAddress
    }
  }

  defenderUrl(contractAddress) {
    return `https://defender.openzeppelin.com/#/admin/contracts/${this.network}-${contractAddress}`
  }

  async send({
    method,
    contract,
    args,
    contractName,
    title,
    description,
    via,
    viaType,
    metadata = {},
  }: {
    method: string
    contract: Pick<Truffle.ContractInstance, "abi" | "address">
    args: any[]
    contractName: string
    title: string
    description: string
    via: string
    viaType: "Gnosis Safe"
    metadata: any
  }) {
    via = via || this.safeAddress
    viaType = viaType || "Gnosis Safe"
    if (method === "pause") {
      title = title || `Pausing ${contractName}`
      await this.client.proposePause(
        {via: via, viaType: viaType, title: title},
        {network: this.network as Network, address: contract.address}
      )
    } else if (method === "unpause") {
      title = title || `Unpausing ${contractName}`
      await this.client.proposeUnpause(
        {via: via, viaType: viaType, title: title},
        {network: this.network as Network, address: contract.address}
      )
    } else {
      const functionInterface = contract.abi.filter((funcAbi) => {
        return funcAbi.name === method && funcAbi.inputs?.length == args.length
      })[0]
      title = title || `Calling ${method} with args of ${args}`
      description = description || "No description provided"
      await this.client.createProposal({
        contract: {address: contract.address, network: this.network as Network}, // Target contract
        title: title,
        description: description,
        type: "custom",
        // Function ABI
        functionInterface: functionInterface,
        functionInputs: args,
        via: via,
        viaType: viaType, // Either Gnosis Safe or Gnosis Multisig
        metadata: metadata,
      })
    }
  }
}

export {DefenderUpgrader}
