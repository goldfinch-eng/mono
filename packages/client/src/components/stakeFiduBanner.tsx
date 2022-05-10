import BigNumber from "bignumber.js"
import {useContext} from "react"
import {FormProvider, useForm} from "react-hook-form"
import {AppContext} from "../App"
import {fiduFromAtomic, FIDU_DECIMALS} from "../ethereum/fidu"
import {CapitalProvider, StakedPositionType} from "../ethereum/pool"
import {useFromSameBlock} from "../hooks/useFromSameBlock"
import useSendFromUser from "../hooks/useSendFromUser"
import {FIDU_APPROVAL_TX_TYPE, STAKE_TX_TYPE} from "../types/transactions"
import {assertNonNullable, displayDollars, displayNumber, displayPercent} from "../utils"
import LoadingButton from "./loadingButton"

interface StakeFiduBannerProps {
  disabled: boolean
  capitalProvider: CapitalProvider | undefined
  actionComplete: () => void
}

export default function StakeFiduBanner(props: StakeFiduBannerProps) {
  const {pool: _pool, user: _user, stakingRewards: _stakingRewards, currentBlock} = useContext(AppContext)
  const sendFromUser = useSendFromUser()
  const formMethods = useForm()
  const consistent = useFromSameBlock({setAsLeaf: false}, currentBlock, _pool, _user, _stakingRewards)

  const stake = async () => {
    assertNonNullable(consistent)
    const pool = consistent[0]
    const user = consistent[1]
    const stakingRewards = consistent[2]
    const amount = new BigNumber(await pool.fidu.userWallet.methods.balanceOf(user.address).call(undefined, "latest"))

    // For the StakingRewards contract to be able to transfer the user's FIDU as part of
    // staking (more precisely, staking directly via `stake()`, as opposed to via `depositAndStake*()`),
    // the user must have approved the StakingRewards contract to do so, in the amount
    // to be transferred. So if the StakingRewards contract is not already thusly approved,
    // staking requires two transactions: one to grant the approval, then one to actually stake.
    const alreadyApprovedAmount = new BigNumber(
      await pool.fidu.userWallet.methods.allowance(user.address, stakingRewards.address).call(undefined, "latest")
    )
    const requiresApproval = amount.gt(alreadyApprovedAmount)
    const approval = requiresApproval
      ? sendFromUser(
          pool.fidu.userWallet.methods.approve(stakingRewards.address, amount.toString(10)),
          {
            type: FIDU_APPROVAL_TX_TYPE,
            data: {
              amount: fiduFromAtomic(amount),
            },
          },
          {rejectOnError: true}
        )
      : Promise.resolve()
    return approval
      .then(() =>
        sendFromUser(stakingRewards.contract.userWallet.methods.stake(amount.toString(10), StakedPositionType.Fidu), {
          type: STAKE_TX_TYPE,
          data: {
            amount: fiduFromAtomic(amount),
            ticker: "FIDU",
          },
        })
      )
      .then(props.actionComplete)
  }

  if (consistent) {
    const pool = consistent[0]
    const stakingRewards = consistent[2]

    // Being eligible for supplying into the senior pool is logically independent of being able to
    // stake any unstaked FIDU you have. So we allow the user to stake here even if
    // `!eligibleForSeniorPool(user)`.
    const disabled = props.disabled || !stakingRewards || stakingRewards.info.value.isPaused

    const placeholderClass = disabled ? "placeholder" : ""

    return props.capitalProvider?.shares.parts.notStaked.gt(0) ? (
      <FormProvider {...formMethods}>
        <div className={`info-banner subtle background-container ${placeholderClass}`}>
          <div className="message">
            {`You have ${displayNumber(
              props.capitalProvider.shares.parts.notStaked.div(FIDU_DECIMALS.toString()),
              2
            )} FIDU (${displayDollars(
              props.capitalProvider.availableToStakeInDollars,
              2
            )}) that is not staked. Stake your FIDU to earn an additional estimated ${displayPercent(
              // NOTE: We do not try to optimistically estimate here what the APY from GFI rewards
              // would be *after* staking -- that is, we don't take into account how the amount
              // of FIDU the user would stake would affect the amount of GFI rewards thenceforth earned
              // by 1 staked FIDU. We simply report the current APY from GFI rewards. Optimistically
              // estimating the APY is not obviously worth the effort of re-creating how the
              // StakingRewards contract would calculate `currentEarnRatePerToken()` with the
              // newly staked FIDU, given that the calculation would have to rely on an assumption
              // of the total leveraged staked supply of FIDU not otherwise changing by the time the user's
              // staking transaction executes. Also, rather than try to be clever by optimistically
              // estimating values that would differ for different users, it seems better to consistently
              // report, in this context, one estimated value that is the same for all users.
              pool.info.value.poolData.estimatedApyFromGfi
            )} APY in GFI.`}
          </div>
          <LoadingButton disabled={disabled} action={stake} text="Stake all FIDU" />
        </div>
      </FormProvider>
    ) : null
  }

  return null
}
