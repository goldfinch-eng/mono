import {usdcFromAtomic, usdcToAtomic} from "../ethereum/erc20"
import {AppContext} from "../App"
import {assertNonNullable, displayDollars} from "../utils"
import TransactionForm from "./transactionForm"
import TransactionInput from "./transactionInput"
import LoadingButton from "./loadingButton"
import useSendFromUser from "../hooks/useSendFromUser"
import useNonNullContext from "../hooks/useNonNullContext"
import BigNumber from "bignumber.js"
import {decimalPlaces} from "../ethereum/utils"
import useERC20Permit from "../hooks/useERC20Permit"

interface DepositFormProps {
  actionComplete: () => void
  closeForm: () => void
}

function DepositForm(props: DepositFormProps) {
  const {pool, usdc, user, goldfinchConfig, stakingRewards} = useNonNullContext(AppContext)
  const sendFromUser = useSendFromUser()
  const {gatherPermitSignature} = useERC20Permit()

  async function action({transactionAmount}) {
    assertNonNullable(stakingRewards)
    const depositAmountString = usdcToAtomic(transactionAmount)
    // USDC permit doesn't work on mainnet forking due to mismatch between hardcoded chain id in the contract
    if (process.env.REACT_APP_HARDHAT_FORK) {
      const alreadyApprovedAmount = new BigNumber(
        await usdc.contract.methods.allowance(user.address, stakingRewards.address).call(undefined, "latest")
      )
      const amountRequiringApproval = new BigNumber(depositAmountString).minus(alreadyApprovedAmount)
      const approval = amountRequiringApproval.gt(0)
        ? sendFromUser(
            usdc.contract.methods.approve(stakingRewards.address, amountRequiringApproval.toString(10)),
            {
              type: "Approve",
              amount: usdcFromAtomic(amountRequiringApproval),
            },
            {rejectOnError: true}
          )
        : Promise.resolve()
      return approval
        .then(() =>
          sendFromUser(stakingRewards.contract.methods.depositAndStake(depositAmountString), {
            type: "Supply and Stake",
            amount: transactionAmount,
          })
        )
        .then(props.actionComplete)
    } else {
      let signatureData = await gatherPermitSignature({
        token: usdc,
        value: new BigNumber(depositAmountString),
        spender: stakingRewards.address,
      })
      return sendFromUser(
        stakingRewards.contract.methods.depositWithPermitAndStake(
          signatureData.value,
          signatureData.deadline,
          signatureData.v,
          signatureData.r,
          signatureData.s
        ),
        {
          type: "Supply and Stake",
          amount: transactionAmount,
        }
      ).then(props.actionComplete)
    }
  }

  function renderForm({formMethods}) {
    let warningMessage, disabled, submitDisabled
    if (!user || user.info.value.usdcBalance.eq(0)) {
      disabled = true
      warningMessage = (
        <p className="form-message">
          You don't have any USDC to supply. You'll need to first send USDC to your address to supply capital.
        </p>
      )
    } else if (pool.info.value.poolData.totalPoolAssets.gte(goldfinchConfig.totalFundsLimit)) {
      disabled = true
      warningMessage = (
        <p className="form-message">
          The pool is currently at its limit. Please check back later to see if the pool has new capacity.
        </p>
      )
    }

    // Must destructure or react-hook-forms does not detect state changes
    const {isDirty, isValid} = formMethods.formState
    if (!isDirty || !isValid) {
      submitDisabled = true
    }
    submitDisabled = submitDisabled || disabled

    const remainingPoolCapacity = pool.info.value.poolData.remainingCapacity(goldfinchConfig.totalFundsLimit)
    const maxTxAmountInDollars = usdcFromAtomic(
      BigNumber.min(
        remainingPoolCapacity,
        goldfinchConfig.transactionLimit,
        user ? user.info.value.usdcBalance : new BigNumber(0)
      )
    )

    return (
      <div className="form-inputs">
        {warningMessage}
        <div className="checkbox-container form-input-label">
          <input
            className="checkbox"
            type="checkbox"
            name="agreement"
            id="agreement"
            ref={(ref) => formMethods.register(ref, {required: "You must agree to the Senior Pool Agreement."})}
          />
          <label className="checkbox-label" htmlFor="agreement">
            <div>
              I agree to the&nbsp;
              <a className="form-link" href="/senior-pool-agreement-non-us" target="_blank">
                Senior Pool Agreement.
              </a>
            </div>
          </label>
        </div>
        <div>
          <div className="form-input-label">Amount</div>
          <div className="form-inputs-footer">
            <TransactionInput
              formMethods={formMethods}
              disabled={disabled}
              maxAmount={remainingPoolCapacity}
              rightDecoration={
                <button
                  className="enter-max-amount"
                  type="button"
                  onClick={() => {
                    formMethods.setValue(
                      "transactionAmount",
                      new BigNumber(maxTxAmountInDollars).decimalPlaces(decimalPlaces, 1).toString(10),
                      {
                        shouldValidate: true,
                        shouldDirty: true,
                      }
                    )
                  }}
                >
                  Max
                </button>
              }
              validations={{
                wallet: (value) =>
                  (user && user.info.value.usdcBalanceInDollars.gte(value)) || "You do not have enough USDC",
                transactionLimit: (value) =>
                  goldfinchConfig.transactionLimit.gte(usdcToAtomic(value)) ||
                  `This is over the per-transaction limit of ${displayDollars(
                    usdcFromAtomic(goldfinchConfig.transactionLimit),
                    0
                  )}`,
                totalFundsLimit: (value) => {
                  return (
                    remainingPoolCapacity.gte(usdcToAtomic(value)) ||
                    `This amount would put the pool over its limit. It can accept a max of $${usdcFromAtomic(
                      remainingPoolCapacity
                    )}.`
                  )
                },
              }}
            />
            <LoadingButton action={action} disabled={submitDisabled} />
          </div>
        </div>
      </div>
    )
  }
  return (
    <TransactionForm
      title="Supply"
      headerMessage={`Available to supply: ${displayDollars(user ? user.info.value.usdcBalanceInDollars : undefined)}`}
      render={renderForm}
      closeForm={props.closeForm}
    />
  )
}

export default DepositForm
