import {Network} from "defender-base-client"
import DefenderProposer from "../DefenderProposer"

class DefenderUpgrader extends DefenderProposer {
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
