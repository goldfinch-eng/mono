/* globals artifacts */
const {SAFE_CONFIG, getDefenderClient, CHAIN_MAPPING} = require("../deployHelpers")
const {CONFIG_KEYS} = require("../configKeys")
const CreditDesk = artifacts.require("CreditDesk")

class DefenderUpgrader {
  constructor({hre, logger, chainId}) {
    this.hre = hre
    this.logger = logger
    this.chainId = chainId
    this.network = CHAIN_MAPPING[chainId]
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
      contract: {address: contractInfo.proxy.address, network: this.network}, // Target contract
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
      contract: {address: oldConfigAddress, network: this.network}, // Target contract
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
      contract: {address: creditDesk.address, network: this.network}, // Target contract
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
      contract: {address: contract.address, network: this.network}, // Target contract
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
}

exports.default = DefenderUpgrader
