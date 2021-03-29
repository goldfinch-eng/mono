const {SAFE_CONFIG, getDefenderClient, CHAIN_MAPPING} = require("../deployHelpers")
const {CONFIG_KEYS} = require("./configKeys")

class DefenderUpgrader {
  constructor({hre, logger, chainId}) {
    this.hre = hre
    this.logger = logger
    this.chainId = chainId
    this.network = CHAIN_MAPPING[chainId]
    this.client = getDefenderClient()
    const safe = SAFE_CONFIG[chainId]
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
