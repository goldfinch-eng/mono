import {deployUniqueIdentity, deployGo} from "../../baseDeploy"
import {
  ContractDeployer,
  ContractUpgrader,
  ETHERS_CONTRACT_PROVIDER,
  getContract,
  getProtocolOwner,
  getTruffleContract,
  isMainnet,
} from "../../deployHelpers"
import hre from "hardhat"
import {GoldfinchConfig} from "../../../typechain/ethers"
import {GoldfinchConfigInstance} from "../../../typechain/truffle"
import {DeployEffects} from "../deployEffects"
import {assertNonNullable} from "packages/utils/src/type"

async function trustedSignerAddress(): Promise<string> {
  if (await isMainnet()) {
    throw new Error("TODO: define trustedSignerAddress for mainnet")
  } else {
    const {protocol_owner: trustedSigner} = await hre.getNamedAccounts()
    assertNonNullable(trustedSigner)
    return trustedSigner
  }
}

export async function deploy(deployEffects: DeployEffects) {
  const deployer = new ContractDeployer(console.log, hre)
  const upgrader = new ContractUpgrader(deployer)

  const upgradedContracts = await upgrader.upgrade({contracts: ["PoolTokens"]})

  const uniqueIdentity = await deployUniqueIdentity({
    deployer,
    trustedSigner: await trustedSignerAddress(),
    deployEffects,
  })

  const config = await getTruffleContract<GoldfinchConfigInstance>("GoldfinchConfig", {from: await getProtocolOwner()})
  const go = await deployGo(deployer, {configAddress: config.address, uniqueIdentity, deployEffects})

  return {
    deployedContracts: {
      uniqueIdentity,
      go,
    },
    upgradedContracts,
  }
}
