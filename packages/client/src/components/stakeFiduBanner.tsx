import BigNumber from "bignumber.js"
import {useContext} from "react"
import {FormProvider, useForm} from "react-hook-form"
import {AppContext} from "../App"
import {fiduFromAtomic, FIDU_DECIMALS} from "../ethereum/fidu"
import {CapitalProvider, PoolData} from "../ethereum/pool"
import {KYC} from "../hooks/useGoldfinchClient"
import {eligibleForSeniorPool} from "../hooks/useKYC"
import useSendFromUser from "../hooks/useSendFromUser"
import {useStakingRewards} from "../hooks/useStakingRewards"
import {displayDollars, displayNumber, displayPercent, assertNonNullable} from "../utils"
import LoadingButton from "./loadingButton"

interface StakeFiduBannerProps {
  poolData: PoolData | undefined
  capitalProvider: CapitalProvider
  kyc: KYC | undefined
  actionComplete: () => void
}

export default function StakeFiduBanner(props: StakeFiduBannerProps) {
  const {pool, user} = useContext(AppContext)
  const sendFromUser = useSendFromUser()
  const stakingRewards = useStakingRewards()
  const formMethods = useForm()

  const stake = async () => {
    assertNonNullable(pool)
    assertNonNullable(stakingRewards)
    const amount = new BigNumber(await pool.fidu.methods.balanceOf(user.address).call())

    // For the StakingRewards contract to be able to transfer the user's FIDU as part of
    // staking (more precisely, staking directly via `stake()`, as opposed to via `depositAndStake*()`),
    // the user must have approved the StakingRewards contract to do so, in the amount
    // to be transferred. So if the StakingRewards contract is not already thusly approved,
    // staking requires two transactions: one to grant the approval, then one to actually stake.
    const alreadyApprovedAmount = new BigNumber(
      await pool.fidu.methods.allowance(user.address, stakingRewards.address).call()
    )
    const amountRequiringApproval = amount.minus(alreadyApprovedAmount)
    const approval = amountRequiringApproval.gt(0)
      ? sendFromUser(
          pool.fidu.methods.approve(stakingRewards.address, amountRequiringApproval.toString(10)),
          {
            type: "Approve",
            amount: fiduFromAtomic(amountRequiringApproval),
          },
          {rejectOnError: true}
        )
      : Promise.resolve()
    return approval
      .then(() =>
        sendFromUser(stakingRewards.contract.methods.stake(amount.toString(10)), {
          type: "Stake",
          amount: fiduFromAtomic(amount),
        })
      )
      .then(props.actionComplete)
  }

  // Being eligible for supplying into the senior pool is logically independent of, and therefore not
  // necessary for, being able to stake any unstaked FIDU you may have. But for consistency of UX in
  // relation to the other actions on the senior pool page, we condition here on having satisfied the
  // same base requirement(s) that the other actions require.
  const userSatisfiesSeniorPoolRequirements = eligibleForSeniorPool(props.kyc, user)
  const disabled = !userSatisfiesSeniorPoolRequirements || !stakingRewards || stakingRewards.info.value.isPaused

  const placeholderClass = disabled ? "placeholder" : ""

  return props.capitalProvider.shares.parts.notStaked.gt(0) ? (
    <FormProvider {...formMethods}>
      <div className={`info-banner subtle background-container ${placeholderClass}`}>
        <div className="message">
          {`You have ${displayNumber(
            props.capitalProvider.shares.parts.notStaked.div(FIDU_DECIMALS.toString()),
            2
          )} FIDU (${displayDollars(
            props.capitalProvider.availableToStakeInDollars,
            2
          )}) that is not staked. Stake FIDU to earn an additional estimated ${displayPercent(
            props.poolData?.estimatedApyFromGfi
          )} APY
          in GFI rewards.`}
        </div>
        <LoadingButton disabled={disabled} action={stake} text="Stake all FIDU" />
      </div>
    </FormProvider>
  ) : null
}
