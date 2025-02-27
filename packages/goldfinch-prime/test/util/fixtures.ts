import {getTruffleContract} from "@goldfinch-eng/goldfinch-prime/blockchain_scripts/deployHelpers"
import {deployments} from "hardhat"

export async function getDeploymentFor<T extends Truffle.ContractInstance>(contractName: string) {
  const deployment = await deployments.get(contractName)
  return getTruffleContract<T>(contractName, {at: deployment.address})
}
