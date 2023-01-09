import {GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/ethers"
import {assertNonNullable} from "@goldfinch-eng/utils"
import {CONFIG_KEYS_BY_TYPE} from "../configKeys"
import {ContractDeployer, populateTxAndLog} from "../deployHelpers"
import {DeployEffects} from "../migrations/deployEffects"

export async function deployMonthlyScheduleRepo(
  deployer: ContractDeployer,
  deployEffects: DeployEffects,
  gfConfig: GoldfinchConfig
) {
  const {gf_deployer} = await deployer.getNamedAccounts()
  assertNonNullable(gf_deployer)

  // Deploy the monthly schedule repo
  const monthlyScheduleRepo = await deployer.deploy("MonthlyScheduleRepo", {
    from: gf_deployer,
  })

  // Set monthly schedule repo address in config
  await deployEffects.add({
    deferred: [
      await populateTxAndLog(
        gfConfig.populateTransaction.setAddress(
          CONFIG_KEYS_BY_TYPE.addresses.MonthlyScheduleRepo,
          monthlyScheduleRepo.address
        ),
        `Populated tx to set the MonthlyScheduleRepo address to ${monthlyScheduleRepo.address}`
      ),
    ],
  })

  return monthlyScheduleRepo
}
