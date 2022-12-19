import {assertIsString} from "@goldfinch-eng/utils"
import {ContractDeployer} from "../deployHelpers"

export async function deploySchedule(deployer: ContractDeployer): Promise<string> {
  const {gf_deployer} = await deployer.getNamedAccounts()
  assertIsString(gf_deployer)

  const periodMapperDeployResult = await deployer.deploy("MonthlyPeriodMapper", {from: gf_deployer})

  // Deploy a schedule for a 12 month bullet loan
  const periodsInTerm = 12
  const periodsPerInterestPeriod = 1
  const periodsPerPrincipalPeriod = 12
  const gracePrincipalPeriods = 0

  // Create a monthly schedule
  const monthlyScheduleDeployResult = await deployer.deploy("Schedule", {
    from: gf_deployer,
    args: [
      periodMapperDeployResult.address,
      periodsInTerm,
      periodsPerInterestPeriod,
      periodsPerPrincipalPeriod,
      gracePrincipalPeriods,
    ],
  })

  return monthlyScheduleDeployResult.address
}
