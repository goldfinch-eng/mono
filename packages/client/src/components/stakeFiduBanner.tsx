import {assertNonNullable} from "@goldfinch-eng/utils/src/type"
import BigNumber from "bignumber.js"
import {useContext} from "react"
import {FormProvider, useForm} from "react-hook-form"
import {AppContext} from "../App"
import {FIDU_DECIMALS} from "../ethereum/fidu"
import {CapitalProvider, PoolData} from "../ethereum/pool"
import useSendFromUser from "../hooks/useSendFromUser"
import {useStakingRewards} from "../hooks/useStakingRewards"
import {displayDollars, displayNumber, displayPercent} from "../utils"
import LoadingButton from "./loadingButton"

interface StakeFiduBannerProps {
  poolData: PoolData | undefined
  capitalProvider: CapitalProvider
}

export default function StakeFiduBanner(props: StakeFiduBannerProps) {
  const {pool, user} = useContext(AppContext)
  const sendFromUser = useSendFromUser()
  const rewards = useStakingRewards()
  const formMethods = useForm()

  const stake = async () => {
    assertNonNullable(pool)
    assertNonNullable(rewards)
    const amount = new BigNumber(await pool.fidu.methods.balanceOf(user.address).call())

    // For the StakingRewards contract to be able to transfer the user's FIDU as part of
    // staking (more precisely, staking directly via `stake()`, as opposed to via `depositAndStake*()`),
    // the user must have approved the StakingRewards contract to do so, in the amount
    // to be transferred. So if the StakingRewards contract is not already thusly approved,
    // staking requires two transactions: one to grant the approval, then one to actually stake.
    const alreadyApprovedAmount = new BigNumber(await pool.fidu.methods.allowance(user.address, rewards.address).call())
    const amountRequiringApproval = amount.minus(alreadyApprovedAmount)
    if (amountRequiringApproval.gt(0)) {
      const amountRequiringApprovalString = amountRequiringApproval.toString(10)
      const amountString = amount.toString(10)
      return sendFromUser(
        pool.fidu.methods.approve(rewards.address, amountRequiringApprovalString),
        {
          type: "Approve",
          amount: amountRequiringApprovalString,
        },
        {rejectOnError: true}
      ).then(() =>
        sendFromUser(rewards.contract.methods.stake(amountString), {
          type: "Stake",
          amount: amountString,
        })
      )
    } else {
      const amountString = amount.toString(10)
      return sendFromUser(rewards.contract.methods.stake(amountString), {
        type: "Stake",
        amount: amountString,
      })
    }
  }

  return props.capitalProvider.shares.parts.notStaked.gt(0) ? (
    <FormProvider {...formMethods}>
      <div className="info-banner background-container">
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
        <LoadingButton action={stake} text="Stake all FIDU" />
      </div>
    </FormProvider>
  ) : null
}
