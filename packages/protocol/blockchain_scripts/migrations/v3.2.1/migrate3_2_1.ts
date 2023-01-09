import {GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/ethers"
import {assertNonNullable} from "@goldfinch-eng/utils"
import hre from "hardhat"
import {deployMonthlyScheduleRepo} from "../../baseDeploy/deployMonthlyScheduleRepo"
import {CONFIG_KEYS_BY_TYPE} from "../../configKeys"
import {
  ContractDeployer,
  ContractUpgrader,
  getEthersContract,
  getProtocolOwner,
  populateTxAndLog,
} from "../../deployHelpers"
import {changeImplementations, getDeployEffects} from "../deployEffects"

export async function main() {
  const deployer = new ContractDeployer(console.log, hre)
  const deployEffects = await getDeployEffects({
    title: "v3.2.1 Upgrade",
    description:
      "Daily Interest Accrual and Calendar Schedules for Tranched Pools: https://github.com/warbler-labs/mono/pull/1306",
  })

  const protocolOwner = await getProtocolOwner()
  const {gf_deployer} = await deployer.getNamedAccounts()
  assertNonNullable(gf_deployer)

  const gfConfig = await getEthersContract<GoldfinchConfig>("GoldfinchConfig")

  const borrowerImpl = await deployer.deploy("Borrower", {
    from: gf_deployer,
  })
  await deployEffects.add({
    deferred: [
      await populateTxAndLog(
        gfConfig.populateTransaction.setBorrowerImplementation(borrowerImpl.address),
        `Populated tx to set CreditLine impl to ${borrowerImpl.address}`
      ),
    ],
  })

  // Deploy Accountant
  const accountant = await deployer.deployLibrary("Accountant", {
    from: gf_deployer,
  })

  // Deploy CreditLine and set CreditLine impl in the config
  const creditLine = await deployer.deploy("CreditLine", {
    from: gf_deployer,
    libraries: {
      Accountant: accountant.address,
    },
  })
  await deployEffects.add({
    deferred: [
      await populateTxAndLog(
        gfConfig.populateTransaction.setCreditLineImplementation(creditLine.address),
        `Populated tx to set CreditLine impl to ${creditLine.address}`
      ),
    ],
  })

  // Deploy TranchingLogic
  const tranchingLogic = await deployer.deployLibrary("TranchingLogic", {
    from: gf_deployer,
  })

  // Deploy TranchedPool and set TranchedPool impl address in the conifg to 0 because
  // going forward the impl will be stored in TranchedPoolImplementation repository
  const tranchedPool = await deployer.deploy("TranchedPool", {
    from: gf_deployer,
    libraries: {
      TranchingLogic: tranchingLogic.address,
    },
  })
  await deployEffects.add({
    deferred: [
      await populateTxAndLog(
        gfConfig.populateTransaction.setTranchedPoolImplementation("0x0000000000000000000000000000000000000000"),
        "Populated tx to set the TranchedPool impl to the null address"
      ),
    ],
  })

  // Deploy the tranched pool implementation repository and add it to the config
  const tranchedPoolImplRepo = await deployer.deploy("TranchedPoolImplementationRepository", {
    from: gf_deployer,
    proxy: {
      owner: protocolOwner,
      execute: {
        init: {
          methodName: "initialize",
          args: [protocolOwner, tranchedPool.address],
        },
      },
    },
  })
  await deployEffects.add({
    deferred: [
      await populateTxAndLog(
        gfConfig.populateTransaction.setAddress(
          CONFIG_KEYS_BY_TYPE.addresses.TranchedPoolImplementationRepository,
          tranchedPoolImplRepo.address
        ),
        `Populated tx to set the TranchedPoolImplementationRepository address to ${tranchedPoolImplRepo.address}`
      ),
    ],
  })

  await deployMonthlyScheduleRepo(deployer, deployEffects, gfConfig)

  const upgrader = new ContractUpgrader(deployer)
  const upgradedContracts = await upgrader.upgrade({contracts: ["GoldfinchConfig", "GoldfinchFactory"]})

  await deployEffects.add(await changeImplementations({contracts: upgradedContracts}))

  await deployEffects.executeDeferred()

  console.log("Finished deploy 3.2.1")
}
