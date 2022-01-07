import {deployGo} from "../../baseDeploy/deployGo"
import {deployUniqueIdentity} from "../../baseDeploy/deployUniqueIdentity"
import {ContractDeployer, ContractUpgrader, getProtocolOwner, getTruffleContract, isMainnet} from "../../deployHelpers"
import hre from "hardhat"
import {GoldfinchConfigInstance} from "../../../typechain/truffle"
import {DeployEffects} from "../deployEffects"
import {assertNonNullable} from "packages/utils/src/type"

const MAINNET_TRUSTED_SIGNER_ADDRESS = "0x125cde169191c6c6c5e71c4a814bb7f7b8ee2e3f"

async function trustedSignerAddress(): Promise<string> {
  if (await isMainnet()) {
    return MAINNET_TRUSTED_SIGNER_ADDRESS
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
