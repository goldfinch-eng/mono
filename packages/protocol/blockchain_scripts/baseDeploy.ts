import {isMainnetForking, assertIsChainId, ContractDeployer, ZAPPER_ROLE} from "./deployHelpers"
import {HardhatRuntimeEnvironment} from "hardhat/types"
import {DeployFunction} from "hardhat-deploy/types"
import {Logger} from "./types"
import {assertNonNullable} from "@goldfinch-eng/utils"
import {getDeployEffects} from "./migrations/deployEffects"
import {getOrDeployUSDC} from "./baseDeploy/getOrDeployUSDC"
import {deployBorrower} from "./baseDeploy/deployBorrower"
import {deployClImplementation} from "./baseDeploy/deployClImplementation"
import {deployCommunityRewards} from "./baseDeploy/deployCommunityRewards"
import {deployFidu} from "./baseDeploy/deployFidu"
import {deployGFI} from "./baseDeploy/deployGFI"
import {deployGoldfinchFactory} from "./baseDeploy/deployGoldfinchFactory"
import {deployLPStakingRewards} from "./baseDeploy/deployLPStakingRewards"
import {deployMerkleDirectDistributor} from "./baseDeploy/deployMerkleDirectDistributor"
import {deployMerkleDistributor} from "./baseDeploy/deployMerkleDistributor"
import {deployPoolTokens} from "./baseDeploy/deployPoolTokens"
import {deploySeniorPool} from "./baseDeploy/deploySeniorPool"
import {deploySeniorPoolStrategies} from "./baseDeploy/deploySeniorPoolStrategies"
import {deployBackerRewards} from "./baseDeploy/deployBackerRewards"
import {deployConfig} from "./baseDeploy/deployConfig"
import {deployGo} from "./baseDeploy/deployGo"
import {deployUniqueIdentity} from "./baseDeploy/deployUniqueIdentity"
import {deployZapper} from "./baseDeploy/deployZapper"
import {getOrDeployFiduUSDCCurveLP} from "./baseDeploy/getorDeployFiduUSDCCurveLP"
import {deployTranchedPoolImplementationRepository} from "./baseDeploy/deployTranchedPoolImplementationRepository"
import * as migrate280 from "../blockchain_scripts/migrations/v2.8.0/migrate"
import * as migrate330 from "../blockchain_scripts/migrations/v3.3.0/migrate3_3_0"

import {deployWithdrawalRequestToken} from "./baseDeploy/deployWithdrawalRequestToken"
import {deployMonthlyScheduleRepo} from "./baseDeploy/deployMonthlyScheduleRepo"

const logger: Logger = console.log

export const TOKEN_LAUNCH_TIME_IN_SECONDS = 1641920400 // Tuesday, January 11, 2022 09:00:00 AM GMT-08:00

export type Deployed<T> = {
  name: string
  contract: T
}

const baseDeploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if (isMainnetForking()) {
    return
  }

  const deployEffects = await getDeployEffects()

  const {getNamedAccounts, getChainId} = hre
  const deployer = new ContractDeployer(logger, hre)
  logger("Starting deploy...")
  const {gf_deployer} = await getNamedAccounts()
  logger("Will be deploying using the gf_deployer account:", gf_deployer)

  const chainId = await getChainId()
  assertIsChainId(chainId)
  logger("Chain id is:", chainId)
  const config = await deployConfig(deployer)
  await getOrDeployUSDC(deployer, config)
  await getOrDeployFiduUSDCCurveLP(deployer, config)
  const fidu = await deployFidu(deployer, config)
  await deployPoolTokens(deployer, {config})
  await deployTranchedPoolImplementationRepository(deployer, {config, deployEffects})
  logger("Granting minter role to Pool")
  const seniorPool = await deploySeniorPool(deployer, {config, fidu})
  await deployBorrower(deployer, {config})
  await deploySeniorPoolStrategies(deployer, {config})
  logger("Deploying WithdrawalRequestToken")
  await deployWithdrawalRequestToken(deployer, {config})
  logger("Deploying GoldfinchFactory")
  await deployGoldfinchFactory(deployer, {config})
  await deployClImplementation(deployer, {config})

  const gfi = await deployGFI(deployer, {config})
  await deployLPStakingRewards(deployer, {config, deployEffects})
  const communityRewards = await deployCommunityRewards(deployer, {config, deployEffects})
  await deployMerkleDistributor(deployer, {communityRewards, deployEffects})
  await deployMerkleDirectDistributor(deployer, {gfi, deployEffects})
  await deployMerkleDistributor(deployer, {
    communityRewards,
    deployEffects,
    contractName: "BackerMerkleDistributor",
    merkleDistributorInfoPath: process.env.BACKER_MERKLE_DISTRIBUTOR_INFO_PATH,
  })
  await deployMerkleDirectDistributor(deployer, {
    gfi,
    deployEffects,
    contractName: "BackerMerkleDirectDistributor",
    merkleDirectDistributorInfoPath: process.env.BACKER_MERKLE_DIRECT_DISTRIBUTOR_INFO_PATH,
  })

  const {protocol_owner: trustedSigner} = await deployer.getNamedAccounts()
  assertNonNullable(trustedSigner)
  const uniqueIdentity = await deployUniqueIdentity({deployer, trustedSigner, deployEffects})

  const go = await deployGo(deployer, {configAddress: config.address, uniqueIdentity, deployEffects})
  await deployBackerRewards(deployer, {configAddress: config.address, deployEffects})

  logger("deploying Zapper and granting it ZAPPER_ROLE role on SeniorPool, StakingRewards, and Go")
  const zapper = await deployZapper(deployer, {config, deployEffects})
  await seniorPool.grantRole(ZAPPER_ROLE, zapper.address, {from: trustedSigner})
  await go.contract.initZapperRole({from: trustedSigner})
  await go.contract.grantRole(await go.contract.ZAPPER_ROLE(), zapper.address, {from: trustedSigner})
  console.log("Setting legacy go list")
  await go.contract.setLegacyGoList(config.address)
  await migrate280.main()

  console.log("Set legacy go list")

  await deployMonthlyScheduleRepo(deployer, deployEffects, config)
  await migrate330.main()

  await deployEffects.executeDeferred()
}

export {baseDeploy, deployBackerRewards}
