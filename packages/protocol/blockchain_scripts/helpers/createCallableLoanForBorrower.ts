import {assertNonNullable} from "@goldfinch-eng/utils"
import BN from "bn.js"
import _ from "lodash"
import {interestAprAsBN, USDCDecimals} from "../../blockchain_scripts/deployHelpers"
import {getDeploymentFor} from "../../test/util/fixtures"
import {
  ERC20Instance,
  MonthlyScheduleRepoInstance,
  GoldfinchFactoryInstance,
  CallableLoanInstance,
} from "../../typechain/truffle"
import {Logger} from "../../blockchain_scripts/types"
import {getTruffleContractAtAddress} from "@goldfinch-eng/protocol/test/testHelpers"
import {impersonateAccount} from "./impersonateAccount"
import {HardhatRuntimeEnvironment} from "hardhat/types"

export async function createCallableLoanForBorrower({
  hre,
  logger,
  goldfinchFactory,
  borrower,
  depositor,
  erc20,
  allowedUIDTypes,
  limitInDollars,
  numPeriods,
  gracePrincipalPeriods,
  numPeriodsPerInterestPeriod,
  numPeriodsPerPrincipalPeriod,
  interestApr = String(interestAprAsBN("14.50")),
  numLockPeriods = 2,
  lateFeeApr = String(interestAprAsBN("2.00")),
  fundableAt = String(new BN(0)), // 0 means immediately
}: {
  hre: HardhatRuntimeEnvironment
  logger: Logger
  goldfinchFactory: GoldfinchFactoryInstance
  borrower: string
  depositor?: string
  erc20: ERC20Instance
  allowedUIDTypes: Array<number>
  limitInDollars?: number
  numPeriods: number
  gracePrincipalPeriods: number
  numPeriodsPerInterestPeriod: number
  numPeriodsPerPrincipalPeriod: number
  interestApr?: string
  numLockPeriods?: number
  lateFeeApr?: string
  fundableAt?: string
}): Promise<CallableLoanInstance> {
  const monthlyScheduleRepo = await getDeploymentFor<MonthlyScheduleRepoInstance>("MonthlyScheduleRepo")
  await monthlyScheduleRepo.createSchedule(
    numPeriods,
    numPeriodsPerPrincipalPeriod,
    numPeriodsPerInterestPeriod,
    gracePrincipalPeriods
  )
  const schedule = await monthlyScheduleRepo.getSchedule(
    numPeriods,
    numPeriodsPerPrincipalPeriod,
    numPeriodsPerInterestPeriod,
    gracePrincipalPeriods
  )

  const limit = String(new BN(limitInDollars || 2000000).mul(USDCDecimals))

  const result = await goldfinchFactory.createCallableLoan(
    borrower,
    limit,
    interestApr,
    numLockPeriods,
    schedule,
    lateFeeApr,
    fundableAt,
    allowedUIDTypes
  )
  const lastEvent = result.logs[result.logs.length - 1]
  const loanAddress = (lastEvent?.args as {loan: string})?.loan
  assertNonNullable(loanAddress)
  const loan = await getTruffleContractAtAddress<CallableLoanInstance>("CallableLoan", loanAddress)
  assertNonNullable(loan)
  logger(`Created a Callable Loan ${loanAddress} for the borrower ${borrower}`)

  if (depositor) {
    const depositAmount = String(new BN(limit).div(new BN(20)))
    await impersonateAccount(hre, depositor)
    await erc20.approve(loanAddress, String(limit), {from: depositor})
    await loan.deposit(numPeriods / numPeriodsPerPrincipalPeriod - (gracePrincipalPeriods + 1), depositAmount, {
      from: depositor,
    })

    logger(`Deposited ${depositAmount} into ${loan.address} via ${depositor}`)
  }
  return loan
}
