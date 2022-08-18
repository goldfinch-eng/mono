import {BigNumber} from "bignumber.js"
import {useState} from "react"
import {useMediaQuery} from "react-responsive"
import {AppContext} from "../../App"
import {usdcFromAtomic, usdcToAtomic} from "../../ethereum/erc20"
import {TranchedPool, TranchedPoolBacker} from "../../ethereum/tranchedPool"
import {decimalPlaces} from "../../ethereum/utils"
import useNonNullContext from "../../hooks/useNonNullContext"
import useSendFromUser from "../../hooks/useSendFromUser"
import {CLAIM_ZAP, UNZAP, WITHDRAW_FROM_TRANCHED_POOL_TX_TYPE} from "../../types/transactions"
import {InfoIcon} from "../../ui/icons"
import {displayDollars} from "../../utils"
import LoadingButton from "../loadingButton"
import {WIDTH_TYPES} from "../styleConstants"
import TransactionForm from "../transactionForm"
import TransactionInput from "../transactionInput"
import {splitWithdrawAmount} from "./splitWithdrawAmount"
import TranchedPoolFundsSourceTooltip from "./TranchedPoolFundsSourceTooltip"
import TranchedPoolWithdrawSourceDropdown from "./TranchedPoolWithdrawSourceDropdown"

export function TranchedPoolWithdrawForm({
  backer,
  tranchedPool,
  actionComplete,
  closeForm,
}: {
  backer: TranchedPoolBacker
  tranchedPool: TranchedPool
  actionComplete: () => void
  closeForm: () => void
}) {
  const isMobile = useMediaQuery({
    query: `(max-width: ${WIDTH_TYPES.screenM})`,
  })

  const {goldfinchConfig, zapper, currentBlock} = useNonNullContext(AppContext)
  const sendFromUser = useSendFromUser()

  /**
   * The currently selected withdrawal source is expected to be "wallet", in which
   * case the funds came directly from the users wallet, or a PoolToken id, in which
   * case the funds came from a zap.
   */
  const [withdrawSource, setWithdrawSource] = useState<string>("wallet")

  function getMaxWithdrawAmountForSource(withdrawSource: string) {
    if (withdrawSource === "wallet") {
      return backer.tokenInfos
        .map((poolToken) => poolToken.principalRedeemable.plus(poolToken.interestRedeemable))
        .reduce((redeemableAmount1, redeemableAmount2) => redeemableAmount1.plus(redeemableAmount2), new BigNumber(0))
    } else {
      const poolTokenInfo = backer.zappedTokenInfos.find((info) => info.id === withdrawSource)
      return poolTokenInfo ? poolTokenInfo.principalRedeemable.plus(poolTokenInfo.interestRedeemable) : new BigNumber(0)
    }
  }

  async function action({transactionAmount}) {
    let withdrawAction
    if (withdrawSource === "wallet") {
      withdrawAction = withdrawFromWalletDeposit(transactionAmount)
    } else {
      withdrawAction = withdrawFromZap(withdrawSource, transactionAmount)
    }
    return withdrawAction.then(actionComplete)
  }

  async function withdrawFromWalletDeposit(transactionAmount: string) {
    const withdrawAmount = usdcToAtomic(transactionAmount)
    let firstToken = backer.tokenInfos[0]!
    if (new BigNumber(withdrawAmount).gt(firstToken.principalRedeemable.plus(firstToken.interestRedeemable))) {
      let splits = splitWithdrawAmount(new BigNumber(withdrawAmount), backer.tokenInfos)
      return sendFromUser(tranchedPool.contract.userWallet.methods.withdrawMultiple(splits.tokenIds, splits.amounts), {
        type: WITHDRAW_FROM_TRANCHED_POOL_TX_TYPE,
        data: {
          amount: withdrawAmount,
        },
      })
    } else {
      return sendFromUser(tranchedPool.contract.userWallet.methods.withdraw(backer.tokenInfos[0]!.id, withdrawAmount), {
        type: WITHDRAW_FROM_TRANCHED_POOL_TX_TYPE,
        data: {
          amount: withdrawAmount,
        },
      })
    }
  }

  function canClaimZap() {
    return (
      tranchedPool.juniorTranche.lockedUntil !== 0 && currentBlock.timestamp > tranchedPool.juniorTranche.lockedUntil
    )
  }

  async function withdrawFromZap(poolTokenId: string, transactionAmount: string) {
    if (canClaimZap()) {
      await sendFromUser(zapper.contract.userWallet.methods.claimTranchedPoolZap(poolTokenId), {
        type: CLAIM_ZAP,
        data: {poolTokenId},
      })
      const withdrawAmount = usdcToAtomic(transactionAmount)
      return sendFromUser(tranchedPool.contract.userWallet.methods.withdraw(poolTokenId, withdrawAmount), {
        type: WITHDRAW_FROM_TRANCHED_POOL_TX_TYPE,
        data: {
          amount: withdrawAmount,
        },
      })
    } else {
      return sendFromUser(zapper.contract.userWallet.methods.unzapToStakingRewards(poolTokenId), {
        type: UNZAP,
        data: {poolTokenId},
      })
    }
  }

  function renderSupplySourceDropdown({formMethods}) {
    function onTranchedPoolWithdrawSourceDropdownChange(selected: string) {
      setWithdrawSource(selected)
      formMethods.setValue(
        "transactionAmount",
        new BigNumber(usdcFromAtomic(getMaxWithdrawAmountForSource(selected)))
          .decimalPlaces(decimalPlaces, 1)
          .toString(10),
        {
          shouldValidate: true,
          shouldDirty: true,
        }
      )
    }
    // You might have thought checking backer.zappedTokenInfos.length === 0 would be sufficient
    // to determine the user has 0 zapped positions but it's not because an unzap doesn't
    // burn the pool token for that zap, it only transfers the full amount back to the user.
    // Thus the pool token is still in the zappedTokenInfos list, now with a 0 balance. And
    // since each subsequent zap creates a new pool token, we can consider the old pool tokens
    // with 0 balances as zombies.
    const nonZeroZappedPositions = backer.zappedTokenInfos.filter((tokenInfo) => {
      const amountRedeemable = tokenInfo.principalRedeemable.plus(tokenInfo.interestRedeemable)
      return amountRedeemable.gt(0)
    })
    if (nonZeroZappedPositions.length === 0) {
      return null
    }

    return (
      <div className="form-input-container">
        <div className="form-input-label-multisource">
          Source
          <span
            data-for="tranched-pool-deposit-tooltip"
            data-tip=""
            data-offset={`{'top': 0, 'left': ${isMobile ? 150 : 0}}`}
            data-place="bottom"
            style={{marginLeft: "2px", paddingTop: "2px"}}
          >
            <InfoIcon />
          </span>
        </div>
        <TranchedPoolWithdrawSourceDropdown
          onChange={onTranchedPoolWithdrawSourceDropdownChange}
          poolTokens={backer.tokenInfos}
          zappedPoolTokens={nonZeroZappedPositions}
        />
        <TranchedPoolFundsSourceTooltip formMethod={canClaimZap() ? "withdrawClaimZap" : "withdrawUnzap"} />
      </div>
    )
  }

  function renderForm({formMethods}) {
    return (
      <div className="form-inputs">
        {renderSupplySourceDropdown({formMethods})}
        <div className="form-inputs-footer">
          {withdrawSource === "wallet" && (
            <TransactionInput
              formMethods={formMethods}
              maxAmount={backer.availableToWithdrawInDollars.toString(10)}
              rightDecoration={
                <button
                  className="enter-max-amount"
                  type="button"
                  onClick={() => {
                    formMethods.setValue(
                      "transactionAmount",
                      new BigNumber(usdcFromAtomic(getMaxWithdrawAmountForSource(withdrawSource)))
                        .decimalPlaces(decimalPlaces)
                        .toString(10),
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
                transactionLimit: (value) =>
                  goldfinchConfig.transactionLimit.gte(usdcToAtomic(value)) ||
                  `This is over the per-transaction limit of ${displayDollars(
                    usdcFromAtomic(goldfinchConfig.transactionLimit),
                    0
                  )}`,
              }}
            />
          )}
          <LoadingButton action={action} />
        </div>
      </div>
    )
  }

  return (
    <TransactionForm
      title="Withdraw"
      headerMessage={`Available to withdraw: ${displayDollars(backer.availableToWithdrawInDollars)}`}
      render={renderForm}
      closeForm={closeForm}
    />
  )
}
