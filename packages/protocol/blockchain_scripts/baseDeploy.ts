import {OWNER_ROLE, MINTER_ROLE, isMainnetForking, assertIsChainId, ContractDeployer} from "./deployHelpers"
import {HardhatRuntimeEnvironment} from "hardhat/types"
import {DeployFunction} from "hardhat-deploy/types"
import {Fidu} from "../typechain/ethers"
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
import {deployPool} from "./baseDeploy/deployPool"
import {deployPoolTokens} from "./baseDeploy/deployPoolTokens"
import {deploySeniorPool} from "./baseDeploy/deploySeniorPool"
import {deploySeniorPoolStrategies} from "./baseDeploy/deploySeniorPoolStrategies"
import {deployTranchedPool} from "./baseDeploy/deployTranchedPool"
import {deployTransferRestrictedVault} from "./baseDeploy/deployTransferRestrictedVault"
import {deployBackerRewards} from "./baseDeploy/deployBackerRewards"
import {deployCreditDesk} from "./baseDeploy/deployCreditDesk"
import {deployConfig} from "./baseDeploy/deployConfig"
import {deployGo} from "./baseDeploy/deployGo"
import {deployUniqueIdentity} from "./baseDeploy/deployUniqueIdentity"

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
  const fidu = await deployFidu(deployer, config)
  await deployPoolTokens(deployer, {config})
  await deployTransferRestrictedVault(deployer, {config})
  const pool = await deployPool(deployer, {config})
  await deployTranchedPool(deployer, {config, deployEffects})
  logger("Granting minter role to Pool")
  await grantMinterRoleToPool(fidu, pool)
  const creditDesk = await deployCreditDesk(deployer, {config})
  await deploySeniorPool(deployer, {config, fidu})
  await deployBorrower(deployer, {config})
  await deploySeniorPoolStrategies(deployer, {config})
  logger("Deploying GoldfinchFactory")
  await deployGoldfinchFactory(deployer, {config})
  await deployClImplementation(deployer, {config})

  const gfi = await deployGFI(deployer, {config})
  await deployLPStakingRewards(deployer, {config, deployEffects})
  const communityRewards = await deployCommunityRewards(deployer, {config, deployEffects})
  await deployMerkleDistributor(deployer, {communityRewards, deployEffects})
  await deployMerkleDirectDistributor(deployer, {gfi, deployEffects})

  const {protocol_owner: trustedSigner} = await deployer.getNamedAccounts()
  assertNonNullable(trustedSigner)
  const uniqueIdentity = await deployUniqueIdentity({deployer, trustedSigner, deployEffects})

  await deployGo(deployer, {configAddress: config.address, uniqueIdentity, deployEffects})
  await deployBackerRewards(deployer, {configAddress: config.address, deployEffects})

  logger("Granting ownership of Pool to CreditDesk")
  await grantOwnershipOfPoolToCreditDesk(pool, creditDesk.address)

  await deployEffects.executeDeferred()
}

export async function grantOwnershipOfPoolToCreditDesk(pool: any, creditDeskAddress: any) {
  const alreadyOwnedByCreditDesk = await pool.hasRole(OWNER_ROLE, creditDeskAddress)
  if (alreadyOwnedByCreditDesk) {
    // We already did this step, so early return
    logger("Looks like Credit Desk already is the owner")
    return
  }
  logger("Adding the Credit Desk as an owner")
  const txn = await pool.grantRole(OWNER_ROLE, creditDeskAddress)
  await txn.wait()
  const nowOwnedByCreditDesk = await pool.hasRole(OWNER_ROLE, creditDeskAddress)
  if (!nowOwnedByCreditDesk) {
    throw new Error(`Expected ${creditDeskAddress} to be an owner, but that is not the case`)
  }
}

export async function grantMinterRoleToPool(fidu: Fidu, pool: any) {
  if (!(await fidu.hasRole(MINTER_ROLE, pool.address))) {
    await fidu.grantRole(MINTER_ROLE, pool.address)
  }
}

export {baseDeploy, deployBackerRewards}
