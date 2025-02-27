import {
  NON_US_INDIVIDUAL_ID_TYPE_0,
  US_ACCREDITED_INDIVIDUAL_ID_TYPE_1,
  US_NON_ACCREDITED_INDIVIDUAL_ID_TYPE_2,
  US_ENTITY_ID_TYPE_3,
  NON_US_ENTITY_ID_TYPE_4,
  assertNonNullable,
} from "@goldfinch-eng/utils"
import {Contract} from "ethers"
import {HardhatRuntimeEnvironment} from "hardhat/types"
import {DeployFunction} from "hardhat-deploy/types"

import {deployConfig} from "./baseDeploy/deployConfig"
import {deployGo} from "./baseDeploy/deployGo"
import {deployGPrime} from "./baseDeploy/deployGPrime"
import {deployUniqueIdentity} from "./baseDeploy/deployUniqueIdentity"
import {getOrDeployUSDC} from "./baseDeploy/getOrDeployUSDC"
import {assertIsChainId, CHAIN_NAME_BY_ID, ContractDeployer, getProtocolOwner, SupportedNetwork} from "./deployHelpers"
import {getResourceAddressForNetwork} from "./deployHelpers/getResourceForNetwork"
import {DeployEffectsParams, getDeployEffects} from "./migrations/deployEffects"
import {Logger} from "./types"

const logger: Logger = console.log

export type Deployed<T extends Contract> = {
  name: string
  contract: T
}

const getBaseDeployWithDeployEffectsParams = function ({
  deployEffectsParams,
}: {
  deployEffectsParams?: DeployEffectsParams
}): DeployFunction {
  const baseDeploy = async (hre: HardhatRuntimeEnvironment) => {
    const deployEffects = await getDeployEffects(deployEffectsParams)

    const {getNamedAccounts, getChainId} = hre
    const deployer = new ContractDeployer(logger, hre)
    logger("Starting deploy...")
    const {gf_deployer} = await getNamedAccounts()
    const protocol_owner = await getProtocolOwner()
    assertNonNullable(gf_deployer)
    assertNonNullable(protocol_owner)
    logger("Will be deploying using the gf_deployer account:", gf_deployer)
    logger("Will be setting the protocol owner/protocol admin:", protocol_owner)

    const chainId = await getChainId()
    assertIsChainId(chainId)
    logger("Chain id is:", chainId)
    const config = await deployConfig(deployer, deployEffects, protocol_owner)

    await getOrDeployUSDC(deployer, deployEffects, config)

    const supportedUIDTypes = [
      NON_US_INDIVIDUAL_ID_TYPE_0,
      US_ACCREDITED_INDIVIDUAL_ID_TYPE_1,
      US_NON_ACCREDITED_INDIVIDUAL_ID_TYPE_2,
      US_ENTITY_ID_TYPE_3,
      NON_US_ENTITY_ID_TYPE_4,
    ]
    const trustedSigner = getResourceAddressForNetwork(
      "Unique Identity Signer",
      CHAIN_NAME_BY_ID[chainId] as SupportedNetwork
    )
    assertNonNullable(trustedSigner)
    const uniqueIdentity = await deployUniqueIdentity({
      deployer,
      trustedSigner,
      supportedUIDTypes,
      config,
      deployEffects,
    })

    await deployGo(deployer, {configAddress: config.address, uniqueIdentity, deployEffects})

    await deployGPrime(deployer, {configAddress: config.address, deployEffects})

    await deployEffects.executeDeferred()
  }
  return baseDeploy
}

const baseDeploy: DeployFunction = getBaseDeployWithDeployEffectsParams({})

export {baseDeploy, getBaseDeployWithDeployEffectsParams}
