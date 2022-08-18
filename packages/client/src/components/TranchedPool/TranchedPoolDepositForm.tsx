import {BigNumber} from "bignumber.js"
import {useEffect, useState} from "react"
import {AppContext} from "../../App"
import {getUsdcFromNumShares, usdcFromAtomic, usdcToAtomic} from "../../ethereum/erc20"
import {StakingRewardsPosition} from "../../ethereum/pool"
import {TranchedPool, TranchedPoolBacker, TRANCHES} from "../../ethereum/tranchedPool"
import {decimalPlaces} from "../../ethereum/utils"
import useERC20Permit from "../../hooks/useERC20Permit"
import {CurrentTxDataByType, SUPPLY_TX_TYPE, ZAP_STAKE_TO_TRANCHED_POOL_TX_TYPE} from "../../types/transactions"
import useNonNullContext from "../../hooks/useNonNullContext"
import useSendFromUser from "../../hooks/useSendFromUser"
import {KnownGoldfinchClient} from "../../hooks/useGoldfinchClient"
import {KnownSession, useSignIn} from "../../hooks/useSignIn"
import {assertError, displayDollars} from "../../utils"
import LoadingButton from "../loadingButton"
import TransactionForm from "../transactionForm"
import TransactionInput from "../transactionInput"
import {StakedPositionType} from "../../ethereum/pool"
import {InfoIcon} from "../../ui/icons"
import TranchedPoolDepositSourceDropdown from "./TranchedPoolDepositSourceDropdown"
import {useMediaQuery} from "react-responsive"
import {WIDTH_TYPES} from "../styleConstants"
import useERC721Approve from "../../hooks/useERC721Approve"
import {fiduFromAtomic} from "../../ethereum/fidu"
import TranchedPoolFundsSourceTooltip from "./TranchedPoolFundsSourceTooltip"

export function TranchedPoolDepositForm({
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
  const {user, pool, zapper, network, stakingRewards, goldfinchConfig, usdc, networkMonitor, setSessionData} =
    useNonNullContext(AppContext)
  const {gatherPermitSignature} = useERC20Permit()
  const erc721Approve = useERC721Approve()
  const sendFromUser = useSendFromUser()
  const [session] = useSignIn()

  const isMobile = useMediaQuery({
    query: `(max-width: ${WIDTH_TYPES.screenM})`,
  })

  /**
   * The user's StakingRewards positions that are unlocked and have non-zero
   * FIDU amount
   */
  const [stakingRewardsPositions, setStakingRewardsPositions] = useState<StakingRewardsPosition[]>([])

  /**
   * The currently selected StakingRewards position in the dropdown. If undefined then
   * the user's wallet is selected.
   */
  const [selectedStakingRewardsPosition, setSelectedStakingRewardsPosition] = useState<
    StakingRewardsPosition | undefined
  >()

  useEffect(() => {
    const _stakingRewardsPositions = user.info.value.stakingRewards.unlockedPositions.filter(
      (unlockedPosition) =>
        unlockedPosition.storedPosition.positionType === StakedPositionType.Fidu &&
        // Since zaps occcur in USDC, and USDC has fewer decimals than FIDU, it's impossible to zap a
        // full StakingRewards position. Hide any positions of FIDU amount less than 0.000001, as
        // anything less would be 0 USDC
        new BigNumber(fiduFromAtomic(unlockedPosition.storedPosition.amount)).gte(new BigNumber(0.000001))
    )
    setStakingRewardsPositions(_stakingRewardsPositions)
  }, [user.info.value.stakingRewards])

  /**
   * Action to submit funds. If the wallet is the selected source of funds perform
   * a deposit to the junior tranche. Otherwise perform a zap to the junior tranche
   * @param transactionAmount the non-atomic usdc amount to deposit/zap
   */
  async function action({transactionAmount, fullName}) {
    let txType
    let data
    if (selectedStakingRewardsPosition) {
      txType = ZAP_STAKE_TO_TRANCHED_POOL_TX_TYPE
      data = {
        tokenId: selectedStakingRewardsPosition.tokenId,
        tranchedPool: tranchedPool.address,
        tranche: tranchedPool.juniorTranche.id.toString(),
        usdcAmount: usdcToAtomic(transactionAmount),
      }
    } else {
      txType = SUPPLY_TX_TYPE
      data = {
        amount: transactionAmount,
      }
    }

    try {
      if (session.status !== "known" && session.status !== "authenticated") {
        throw new Error("Not signed in. Please refresh the page and try again")
      }
      const client = new KnownGoldfinchClient(network.name!, session as KnownSession, setSessionData)
      const response = await client.signAgreement(user.address, fullName, tranchedPool.address)
      if (response.json.status !== "success") {
        throw new Error(response.json.error)
      }
    } catch (e: unknown) {
      assertError(e)

      // Although it's not really a transaction error, this feels cleaner and more consistent than showing a form error
      const txData = networkMonitor.addPendingTX({type: txType, data: data})
      networkMonitor.markTXErrored(txData, e)
      return
    }

    if (txType === SUPPLY_TX_TYPE) {
      return supply(data)
    } else {
      return zap(data)
    }
  }

  async function zap(data: CurrentTxDataByType[typeof ZAP_STAKE_TO_TRANCHED_POOL_TX_TYPE]) {
    // Ask the user to approve the Zapper contract on their StakingRewards token
    await erc721Approve(stakingRewards, zapper.address)

    // Perfom zap now that we have approval
    return sendFromUser(
      zapper.contract.userWallet.methods.zapStakeToTranchedPool(
        data.tokenId,
        data.tranchedPool,
        data.tranche,
        data.usdcAmount
      ),
      {
        type: ZAP_STAKE_TO_TRANCHED_POOL_TX_TYPE,
        data,
      }
    ).then(actionComplete)
  }

  async function supply(data: CurrentTxDataByType[typeof SUPPLY_TX_TYPE]) {
    const depositAmount = usdcToAtomic(data.amount)
    const signatureData = await gatherPermitSignature({
      token: usdc,
      value: new BigNumber(depositAmount),
      spender: tranchedPool.address,
    })
    return sendFromUser(
      tranchedPool.contract.userWallet.methods.depositWithPermit(
        TRANCHES.Junior,
        signatureData.value,
        signatureData.deadline,
        signatureData.v,
        signatureData.r,
        signatureData.s
      ),
      {
        type: SUPPLY_TX_TYPE,
        data,
      }
    ).then(actionComplete)
  }

  /**
   * Renders the dropdown from which the user selects their source of funds.
   * This only renders if they have one or more staked Fidu positions.
   */
  function renderSupplyDropdown({formMethods}) {
    function onTranchePoolDepositSourceDropdownChange(selected: string) {
      if (selected === "wallet") {
        setSelectedStakingRewardsPosition(undefined)
      } else {
        const newSelectedStakedFiduPosition = stakingRewardsPositions.filter(
          (position) => position.tokenId === selected
        )[0]
        setSelectedStakingRewardsPosition(newSelectedStakedFiduPosition)
      }
      formMethods.setValue("transactionAmount", "", {
        shouldValidate: true,
        shouldDirty: true,
      })
    }

    if (stakingRewardsPositions.length === 0) {
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
        <TranchedPoolDepositSourceDropdown
          onChange={onTranchePoolDepositSourceDropdownChange}
          walletAddress={user.address}
          sharePrice={pool.info.value.poolData.sharePrice}
          stakedFiduPositions={stakingRewardsPositions}
        />
        <TranchedPoolFundsSourceTooltip formMethod="deposit" />
      </div>
    )
  }

  /**
   * Compute the maximum amount the user can contribute from the currently
   * selected source of funds. This is either their wallet's USDC balance
   * or the FIDU balance of the selected StakingRewards position, converted
   * to USDC based on the current share price.
   * @returns atomic USDC amount
   */
  function getMaxContributionFromUser(): BigNumber {
    let contribAmount = user.info.value.usdcBalance
    if (selectedStakingRewardsPosition) {
      const sharePrice = pool.info.value.poolData.sharePrice
      const fiduAtomic = selectedStakingRewardsPosition.storedPosition.amount
      const usdcAtomic = getUsdcFromNumShares(fiduAtomic, sharePrice)
      contribAmount = usdcAtomic
    }
    return contribAmount
  }

  function renderForm({formMethods}) {
    const remainingJuniorCapacity = tranchedPool?.remainingJuniorCapacity()
    const backerLimitPercent = new BigNumber(
      tranchedPool.metadata?.backerLimit ?? process.env.REACT_APP_GLOBAL_BACKER_LIMIT ?? "1"
    )
    const backerLimit = tranchedPool.creditLine.limit.multipliedBy(backerLimitPercent)

    const maxTxAmountInDollars = usdcFromAtomic(
      BigNumber.min(
        backerLimit,
        remainingJuniorCapacity,
        getMaxContributionFromUser(),
        goldfinchConfig.transactionLimit
      )
    )

    const disabled =
      (selectedStakingRewardsPosition === undefined && user.info.value.usdcBalance.eq(0)) ||
      (selectedStakingRewardsPosition !== undefined && selectedStakingRewardsPosition.storedPosition.amount.eq(0))
    const warningMessage = user.info.value.usdcBalance.eq(0) ? (
      <p className="form-message">
        You don't have any USDC to deposit. You'll need to first send USDC to your address to deposit.
      </p>
    ) : undefined

    return (
      <div className="form-inputs">
        {warningMessage}
        <div className="form-footer-message">
          By entering my name and clicking “I Agree” below, I hereby agree and acknowledge that (i) I am electronically
          signing and becoming a party to the{" "}
          <a className="form-link" href={tranchedPool?.metadata?.agreement} target="_blank" rel="noreferrer">
            Loan Agreement
          </a>{" "}
          for this pool, and (ii) my name and transaction information may be shared with the borrower.
        </div>
        <div className="form-input-container">
          <div className="form-input-label">Full legal name</div>
          <input
            type="text"
            name="fullName"
            placeholder="Name"
            className="form-input small-text"
            ref={formMethods.register({required: "Your full name is required"})}
          />
        </div>
        {renderSupplyDropdown({formMethods})}
        <div className="form-inputs-footer">
          <div>
            <div style={{display: "flex", justifyContent: "space-between"}}>
              <div className="form-input-label">Supply Amount</div>
              <div className="form-input-label">
                Balance: {displayDollars(usdcFromAtomic(getMaxContributionFromUser()))}
              </div>
            </div>
            <TransactionInput
              formMethods={formMethods}
              disabled={disabled}
              maxAmount={maxTxAmountInDollars}
              className={" "}
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
                wallet: (value) => {
                  let maxValue = user.info.value.usdcBalanceInDollars
                  if (selectedStakingRewardsPosition) {
                    maxValue = new BigNumber(
                      usdcFromAtomic(
                        getUsdcFromNumShares(
                          selectedStakingRewardsPosition.storedPosition.amount,
                          pool.info.value.poolData.sharePrice
                        )
                      )
                    )
                  }
                  return maxValue.gte(value) || "You do not have enough USDC"
                },
                backerLimit: (value) => {
                  const backerDeposits = backer.principalAmount
                    .minus(backer.principalRedeemed)
                    .plus(usdcToAtomic(value))
                  return (
                    backerDeposits.lte(backerLimit) ||
                    `This is over the per-backer limit for this pool of $${usdcFromAtomic(backerLimit)}`
                  )
                },
                transactionLimit: (value) =>
                  goldfinchConfig.transactionLimit.gte(usdcToAtomic(value)) ||
                  `This is over the per-transaction limit of ${displayDollars(
                    usdcFromAtomic(goldfinchConfig.transactionLimit),
                    0
                  )}`,
                totalFundsLimit: (value) => {
                  return (
                    remainingJuniorCapacity?.gte(usdcToAtomic(value)) ||
                    `This deposit would put the pool over its limit. It can accept a max of $${usdcFromAtomic(
                      remainingJuniorCapacity
                    )}.`
                  )
                },
              }}
            />
          </div>
          <LoadingButton action={action} disabled={disabled} text="I Agree" marginTop="22px" />
        </div>
      </div>
    )
  }

  return (
    <TransactionForm
      title="Supply"
      headerMessage={`Available to supply: ${displayDollars(usdcFromAtomic(getMaxContributionFromUser()))}`}
      render={renderForm}
      closeForm={closeForm}
    />
  )
}
