import {assertNonNullable, NON_US_UID_TYPES, US_UID_TYPES_SANS_NON_ACCREDITED} from "@goldfinch-eng/utils"
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
import {MAINNET_GOVERNANCE_MULTISIG, MAINNET_WARBLER_LABS_MULTISIG} from "../mainnetForkingHelpers"

// Fazz is the company which owns the borrower address for the first callable loan deal
export const FAZZ_EOA = "0x38665165d1ef46f706b8873e0985521de04947a4"
export const FAZZ_DEAL_LIMIT_IN_DOLLARS = 2_000_000
export const FAZZ_DEAL_ALLOWED_UID_TYPES = [...NON_US_UID_TYPES, ...US_UID_TYPES_SANS_NON_ACCREDITED]
export const FAZZ_DEAL_CALLABLE_LOAN_SCHEDULE_CONFIG = {
  numLockPeriods: 2,
  numPeriods: 24,
  numPeriodsPerPrincipalPeriod: 3,
  numPeriodsPerInterestPeriod: 1,
  gracePrincipalPeriods: 0,
}
export const FAZZ_DEAL_FUNDABLE_AT = String(new BN(Date.parse("28 Mar 2023 09:00:00 PDT") / 1000))
export const FAZZ_DEAL_INTEREST_APR = String(interestAprAsBN("14.50"))
export const FAZZ_DEAL_LATE_FEE_APR = String(interestAprAsBN("2.00"))

export const FAZZ_DEAL_UNCALLED_CAPITAL_TRANCHE =
  FAZZ_DEAL_CALLABLE_LOAN_SCHEDULE_CONFIG.numPeriods /
    FAZZ_DEAL_CALLABLE_LOAN_SCHEDULE_CONFIG.numPeriodsPerPrincipalPeriod -
  FAZZ_DEAL_CALLABLE_LOAN_SCHEDULE_CONFIG.gracePrincipalPeriods -
  1

export async function createFazzExampleLoan({
  hre,
  goldfinchFactory,
  erc20,
  fazzBorrowerContract,
  callableLoanProxyOwner = MAINNET_WARBLER_LABS_MULTISIG,
  logger = console.log,
  txSender = MAINNET_GOVERNANCE_MULTISIG,
}: {
  hre: HardhatRuntimeEnvironment
  goldfinchFactory: GoldfinchFactoryInstance
  erc20: ERC20Instance
  fazzBorrowerContract: string
  callableLoanProxyOwner?: string
  txSender?: string
  logger?: Logger
}): Promise<CallableLoanInstance> {
  return createCallableLoanForBorrower({
    hre,
    logger,
    goldfinchFactory,
    callableLoanProxyOwner,
    borrower: fazzBorrowerContract,
    erc20,
    allowedUIDTypes: FAZZ_DEAL_ALLOWED_UID_TYPES,
    limitInDollars: FAZZ_DEAL_LIMIT_IN_DOLLARS,
    txSender,
    interestApr: FAZZ_DEAL_INTEREST_APR,
    lateFeeApr: FAZZ_DEAL_INTEREST_APR,
    fundableAt: FAZZ_DEAL_FUNDABLE_AT,
    ...FAZZ_DEAL_CALLABLE_LOAN_SCHEDULE_CONFIG,
  })
}

export async function createCallableLoanForBorrower({
  hre,
  goldfinchFactory,
  callableLoanProxyOwner,
  borrower,
  depositor,
  erc20,
  allowedUIDTypes,
  limitInDollars,
  numLockPeriods,
  numPeriods,
  gracePrincipalPeriods,
  numPeriodsPerInterestPeriod,
  numPeriodsPerPrincipalPeriod,
  txSender,
  logger = console.log,
  interestApr = FAZZ_DEAL_INTEREST_APR,
  lateFeeApr = String(interestAprAsBN("2.00")),
  fundableAt = String(new BN(0)), // 0 means immediately
}: {
  hre: HardhatRuntimeEnvironment

  goldfinchFactory: GoldfinchFactoryInstance
  callableLoanProxyOwner: string
  borrower: string
  depositor?: string
  erc20: ERC20Instance
  allowedUIDTypes: Array<number>
  limitInDollars?: number
  numLockPeriods: number
  numPeriods: number
  gracePrincipalPeriods: number
  numPeriodsPerInterestPeriod: number
  numPeriodsPerPrincipalPeriod: number
  txSender: string
  logger?: Logger
  interestApr?: string
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

  const result = await goldfinchFactory.createCallableLoanWithProxyOwner(
    callableLoanProxyOwner,
    borrower,
    limit,
    interestApr,
    numLockPeriods,
    schedule,
    lateFeeApr,
    fundableAt,
    allowedUIDTypes,
    {from: txSender}
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
