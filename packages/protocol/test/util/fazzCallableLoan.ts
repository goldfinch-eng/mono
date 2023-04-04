import {
  FAZZ_DEAL_FUNDABLE_AT,
  FAZZ_DEAL_UNCALLED_CAPITAL_TRANCHE,
} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/createCallableLoanForBorrower"
import {impersonateAccount} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/impersonateAccount"
import {advanceTime, getCurrentTimestamp} from "@goldfinch-eng/protocol/test/testHelpers"
import {CallableLoanInstance, ERC20Instance} from "@goldfinch-eng/protocol/typechain/truffle"
import BN from "bn.js"
import {HardhatRuntimeEnvironment} from "hardhat/types"

export async function makeDeposit({
  hre,
  callableLoan,
  usdc,
  lender,
  depositAmount,
}: {
  hre: HardhatRuntimeEnvironment
  callableLoan: CallableLoanInstance
  usdc: ERC20Instance
  lender: string
  depositAmount: BN
}) {
  const currentTimestamp = await getCurrentTimestamp()
  if (currentTimestamp < new BN(FAZZ_DEAL_FUNDABLE_AT)) {
    await advanceTime({toSecond: new BN(FAZZ_DEAL_FUNDABLE_AT).add(new BN(1))})
  }
  await impersonateAccount(hre, lender)
  await usdc.approve(callableLoan.address, depositAmount, {from: lender})
  await callableLoan.deposit(FAZZ_DEAL_UNCALLED_CAPITAL_TRANCHE, depositAmount, {
    from: lender,
  })
}
