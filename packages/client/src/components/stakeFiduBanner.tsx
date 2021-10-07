import {assertNonNullable} from "@goldfinch-eng/utils/src/type"
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
    const amount = await pool.fidu.methods.balanceOf(user.address).call()
    return sendFromUser(
      pool.fidu.methods.approve(rewards.address, amount),
      {
        type: "Approve",
        amount: amount,
      },
      {rejectOnError: true}
    ).then(() =>
      sendFromUser(rewards.contract.methods.stake(amount), {
        type: "Stake",
        amount: amount,
      })
    )
  }

  return props.capitalProvider.numShares.gt(0) ? (
    <FormProvider {...formMethods}>
      <div className="info-banner background-container">
        <div className="message">
          {`You have ${displayNumber(
            props.capitalProvider.numShares.div(FIDU_DECIMALS.toString()),
            2
          )} FIDU (${displayDollars(
            props.capitalProvider.availableToWithdrawInDollars,
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
