import BigNumber from "bignumber.js"
import {useContext} from "react"
import {FormProvider, useForm} from "react-hook-form"
import {AppContext} from "../App"
import {fiduFromAtomic, FIDU_DECIMALS} from "../ethereum/fidu"
import {CapitalProvider} from "../ethereum/pool"
import {useFromSameBlock} from "../hooks/useFromSameBlock"
import {KYC} from "../hooks/useGoldfinchClient"
import {eligibleForSeniorPool} from "../hooks/useKYC"
import useSendFromUser from "../hooks/useSendFromUser"
import {displayDollars, displayNumber, displayPercent, assertNonNullable} from "../utils"
import LoadingButton from "./loadingButton"

interface StakeFiduBannerProps {
  capitalProvider: CapitalProvider | undefined
  kyc: KYC | undefined
  actionComplete: () => void
}

export default function StakeFiduBanner(props: StakeFiduBannerProps) {
  const {pool: _pool, user: _user, stakingRewards: _stakingRewards, currentBlock} = useContext(AppContext)
  const sendFromUser = useSendFromUser()
  const formMethods = useForm()
  const consistent = useFromSameBlock(currentBlock, _pool, _user, _stakingRewards)

  const stake = async () => {
    assertNonNullable(consistent)
    const pool = consistent[0]
    const user = consistent[1]
    const stakingRewards = consistent[2]
    const amount = new BigNumber(await pool.fidu.methods.balanceOf(user.address).call(undefined, "latest"))

    // For the StakingRewards contract to be able to transfer the user's FIDU as part of
    // staking (more precisely, staking directly via `stake()`, as opposed to via `depositAndStake*()`),
    // the user must have approved the StakingRewards contract to do so, in the amount
    // to be transferred. So if the StakingRewards contract is not already thusly approved,
    // staking requires two transactions: one to grant the approval, then one to actually stake.
    const alreadyApprovedAmount = new BigNumber(
      await pool.fidu.methods.allowance(user.address, stakingRewards.address).call(undefined, "latest")
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

  if (consistent) {
    const pool = consistent[0]
    const user = consistent[1]
    const stakingRewards = consistent[2]

    // Being eligible for supplying into the senior pool is logically independent of, and therefore not
    // necessary for, being able to stake any unstaked FIDU you may have. But for consistency of UX in
    // relation to the other actions on the senior pool page, we condition here on having satisfied the
    // same base requirement(s) that the other actions require.
    const userSatisfiesSeniorPoolRequirements = eligibleForSeniorPool(props.kyc, user)
    const disabled = !userSatisfiesSeniorPoolRequirements || !stakingRewards || stakingRewards.info.value.isPaused

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
            )}) that is not staked. Stake FIDU to earn an additional estimated ${displayPercent(
              pool.info.value.poolData.estimatedApyFromGfi
            )} APY
          in GFI rewards.`}
          </div>
          <LoadingButton disabled={disabled} action={stake} text="Stake all FIDU" />
        </div>
      </FormProvider>
    ) : null
  }

  return null
}
