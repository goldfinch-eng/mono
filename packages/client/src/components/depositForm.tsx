import {usdcFromAtomic, usdcToAtomic} from "../ethereum/erc20"
import {AppContext} from "../App"
import {assertNonNullable, displayDollars} from "../utils"
import TransactionForm from "./transactionForm"
import TransactionInput from "./transactionInput"
import LoadingButton from "./loadingButton"
import useSendFromUser from "../hooks/useSendFromUser"
import useNonNullContext from "../hooks/useNonNullContext"
import BigNumber from "bignumber.js"
import {decimalPlaces, MAX_UINT} from "../ethereum/utils"
import useERC20Permit from "../hooks/useERC20Permit"
import {USDC_APPROVAL_TX_TYPE, SUPPLY_AND_STAKE_TX_TYPE, SUPPLY_TX_TYPE} from "../types/transactions"
import {SeniorPoolLoaded, StakedPositionType, StakingRewardsLoaded} from "../ethereum/pool"
import {getLegalLanguage} from "./KYCNotice/utils"
import useGeolocation from "../hooks/useGeolocation"
import StakingPrompt from "./StakingPrompt"

const STAKING_FORM_VAL = "staking"
const defaultValues = {
  [STAKING_FORM_VAL]: true,
}

interface DepositFormProps {
  actionComplete: () => void
  closeForm: () => void
}

function DepositForm(props: DepositFormProps) {
  const {pool, usdc, user, goldfinchConfig, stakingRewards} = useNonNullContext(AppContext)
  const sendFromUser = useSendFromUser()
  const {gatherPermitSignature} = useERC20Permit()
  const geolocation = useGeolocation()
  const {seniorPoolLegalRoute} = getLegalLanguage({
    user,
    allowedUIDTypes: pool?.info.value.poolData.allowedUIDTypes || [],
    geolocation,
  })

  async function approve(depositAmount: string, operator: SeniorPoolLoaded | StakingRewardsLoaded): Promise<void> {
    const alreadyApprovedAmount = new BigNumber(
      await usdc.contract.userWallet.methods.allowance(user.address, operator.address).call(undefined, "latest")
    )
    const requiresApproval = new BigNumber(depositAmount).gt(alreadyApprovedAmount)
    return requiresApproval
      ? sendFromUser(
          usdc.contract.userWallet.methods.approve(
            operator.address,
            // Since we have to ask for approval, we'll ask for the max amount, so that the user will never
            // need to grant approval again (i.e. which saves them the gas cost of ever having to approve again).
            MAX_UINT
          ),
          {
            type: USDC_APPROVAL_TX_TYPE,
            data: {
              amount: usdcFromAtomic(MAX_UINT.toString()),
            },
          },
          {rejectOnError: true}
        )
      : Promise.resolve()
  }

  async function action(formValues: {transactionAmount: string; [STAKING_FORM_VAL]: boolean}) {
    const {transactionAmount, staking} = formValues
    assertNonNullable(stakingRewards)
    const depositAmountString = usdcToAtomic(transactionAmount)
    if (staking) {
      // USDC permit doesn't work on mainnet forking due to mismatch between hardcoded chain id in the contract
      let signatureData = await gatherPermitSignature({
        token: usdc,
        value: new BigNumber(depositAmountString),
        spender: stakingRewards.address,
      })
      return sendFromUser(
        stakingRewards.contract.userWallet.methods.depositWithPermitAndStake(
          signatureData.value,
          signatureData.deadline,
          signatureData.v,
          signatureData.r,
          signatureData.s
        ),
        {
          type: SUPPLY_AND_STAKE_TX_TYPE,
          data: {
            amount: transactionAmount,
          },
        }
      ).then(props.actionComplete)
    } else {
      return approve(depositAmountString, pool)
        .then(() =>
          sendFromUser(pool.contract.userWallet.methods.deposit(depositAmountString), {
            type: SUPPLY_TX_TYPE,
            data: {
              amount: transactionAmount,
            },
          })
        )
        .then(props.actionComplete)
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
        <StakingPrompt
          stakingApy={pool.info.value.poolData.estimatedApyFromGfi}
          stakedPositionType={StakedPositionType.Fidu}
          onToggle={(val) => formMethods.setValue(STAKING_FORM_VAL, val)}
          formVal={STAKING_FORM_VAL}
        />
        <div className="checkbox-container form-input-label">
          <input
            data-testid="agreement"
            className="checkbox"
            type="checkbox"
            name="agreement"
            id="agreement"
            ref={(ref) => formMethods.register(ref, {required: "You must agree to the Senior Pool Agreement."})}
          />
          <label className="checkbox-label" htmlFor="agreement">
            <div>
              <div className="checkbox-label-primary">
                I agree to the&nbsp;
                <a
                  className="form-link checkbox-label-link"
                  href={seniorPoolLegalRoute}
                  target="_blank"
                  rel="noreferrer"
                >
                  Senior Pool Agreement.
                </a>
              </div>
            </div>
          </label>
        </div>
        <div>
          <div className="form-input-label">Amount</div>
          <div className="form-inputs-footer">
            <TransactionInput
              formMethods={formMethods}
              disabled={disabled}
              maxAmount={maxTxAmountInDollars}
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
          <div className="form-footer-message purp-light">
            Note: the protocol deducts a 0.50% fee on withdrawal for protocol reserves.
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
      defaultValues={defaultValues}
    />
  )
}

export default DepositForm
