import {HardhatRuntimeEnvironment} from "hardhat/types"

import {SAFE_CONFIG, getDefenderClient, CHAIN_NAME_BY_ID, ChainId, AddressString, ChainName} from "../deployHelpers"
import {CONFIG_KEYS} from "../configKeys"
import {AdminClient} from "defender-admin-client"
import {Network} from "defender-base-client"
import {artifacts} from "hardhat"

const CreditDesk = artifacts.require("CreditDesk")

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

  async changeImplementation(contractName, contractInfo) {
    this.logger("Now attempting to create the proposal on Defender...")
    await this.client.createProposal({
      contract: {address: contractInfo.proxy.address, network: this.network as Network}, // Target contract
      title: "Upgrade to latest version",
      description: `Upgrading ${contractName} to a new implementation at ${contractInfo.newImplementation}`,
      type: "custom",
      functionInterface: {
        name: "changeImplementation",
        inputs: [
          {internalType: "address", name: "newImplementation", type: "address"},
          {internalType: "bytes", name: "data", type: "bytes"},
        ],
      },
      functionInputs: [contractInfo.newImplementation, "0x"],
      via: this.safeAddress,
      viaType: "Gnosis Safe", // Either Gnosis Safe or Gnosis Multisig
    })
    this.logger("Defender URL: ", this.defenderUrl(contractInfo.proxy.address))
  }

  async setNewConfigAddress(oldConfigAddress, newConfigAddress) {
    this.logger(`Proposing new config address ${newConfigAddress} on config ${oldConfigAddress}`)
    await this.client.createProposal({
      contract: {address: oldConfigAddress, network: this.network as Network}, // Target contract
      title: "Set new config address",
      description: `Set config address on ${oldConfigAddress} to a new address ${newConfigAddress}`,
      type: "custom",
      functionInterface: {
        name: "setAddress",
        inputs: [
          {internalType: "uint256", name: "addressIndex", type: "uint256"},
          {internalType: "address", name: "newAddress", type: "address"},
        ],
      },
      functionInputs: [CONFIG_KEYS.GoldfinchConfig.toString(), newConfigAddress],
      via: this.safeAddress,
      viaType: "Gnosis Safe", // Either Gnosis Safe or Gnosis Multisig
    })
    this.logger("Defender URL: ", this.defenderUrl(oldConfigAddress))
  }

  async createCreditLine(
    creditDesk,
    {borrower, limit, interestApr, paymentPeriodInDays, termInDays, lateFeeApr, description}
  ) {
    const functionInterface = CreditDesk.abi.filter((funcAbi) => funcAbi.name === "createCreditLine")[0]
    await this.client.createProposal({
      contract: {address: creditDesk.address, network: this.network as Network}, // Target contract
      title: "Create credit line",
      description: `${description || "Creating a new credit line for " + borrower}`,
      type: "custom",
      functionInterface: functionInterface,
      functionInputs: [borrower, limit, interestApr, paymentPeriodInDays, termInDays, lateFeeApr],
      via: this.goldfinchUnderwriter,
      viaType: "Gnosis Safe", // Either Gnosis Safe or Gnosis Multisig
    })
    this.logger("Defender URL: ", this.defenderUrl(creditDesk.address))
  }

  async updateGoldfinchConfig(contractName, contract) {
    this.logger(`Proposing new config on ${contractName} (${contract.address})`)
    await this.client.createProposal({
      contract: {address: contract.address, network: this.network as Network}, // Target contract
      title: "Set new config",
      description: `Set new config on ${contractName}`,
      type: "custom",
      // Function ABI
      functionInterface: {
        name: "updateGoldfinchConfig",
        inputs: [],
      },
      functionInputs: [],
      via: this.safeAddress,
      viaType: "Gnosis Safe", // Either Gnosis Safe or Gnosis Multisig
    })
    this.logger("Defender URL: ", this.defenderUrl(contract.address))
  }

  async send({method, contract, args, contractName, title, description, via, viaType, metadata = {}}) {
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
        return funcAbi.name === method && funcAbi.inputs.length == args.length
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
