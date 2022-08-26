import BigNumber from "bignumber.js"
import {useContext, useEffect, useState} from "react"
import {AppContext} from "../App"
import {fetchCapitalProviderData, StakedPositionType, StakingRewardsPosition} from "../ethereum/pool"
import {AssertionError, assertNonNullable} from "../utils"
import {useFromSameBlock} from "./useFromSameBlock"
import useSendFromUser from "./useSendFromUser"
import {
  DEPOSIT_TO_CURVE_AND_STAKE_TX_TYPE,
  DEPOSIT_TO_CURVE_TX_TYPE,
  STAKE_TX_TYPE,
  UNSTAKE_TX_TYPE,
  ZAP_STAKE_TO_CURVE_TX_TYPE,
} from "../types/transactions"
import {gfiToDollarsAtomic} from "../ethereum/gfi"
import {ONE_YEAR_SECONDS} from "../ethereum/utils"
import useERC20Approve from "./useERC20Approve"
import useERC721Approve from "./useERC721Approve"
import {getERC20Metadata, getMultiplierDecimals, Ticker, toDecimalString} from "../ethereum/erc20"
import {requestUserAddERC20TokenToWallet} from "../web3"
import {positionTypeToTicker} from "../components/Stake/utils"

const APY_DECIMALS = new BigNumber(1e18)
const GFI_DECIMALS = getMultiplierDecimals(Ticker.GFI)

type StakingData = {
  // Amount of FIDU the user has staked (denominated in FIDU decimals - 1e18)
  fiduStaked: BigNumber
  // Amount of FIDU the user has unstaked (denominated in FIDU decimals - 1e18)
  fiduUnstaked: BigNumber
  // Amount of FIDU-USDC-F the user has staked (denominated in FIDU-USDC-F decimals - 1e18)
  fiduUSDCCurveStaked: BigNumber
  // Amount of FIDU-USDC-F the user has unstaked (denominated in FIDU-USDC-F decimals - 1e18)
  fiduUSDCCurveUnstaked: BigNumber
  // Amount of USDC in the user's wallet (denominated in USDC decimals - 1e6)
  usdcUnstaked: BigNumber
  // Estimated APY when staking FIDU
  estimatedFiduStakingApy: BigNumber
  // Estimated APY when staking Curve. This does not represent the total APY; it
  // represents the APY on the FIDU portion of the Curve LP token.
  estimatedCurveStakingApy: BigNumber
  // Estimated total APY when staking Curve. This represents the APY on both the
  // FIDU and USDC portion of the Curve LP token.
  estimatedTotalCurveStakingApy: BigNumber
  // FIDU share price (denominated in FIDU decimals - 1e18)
  fiduSharePrice: BigNumber
  stake: (BigNumber, StakedPositionType) => Promise<any>
  unstake: (BigNumber, StakedPositionType) => Promise<any>
  depositToCurve: (fiduAmount: BigNumber, usdcAmount: BigNumber) => Promise<any>
  depositToCurveAndStake: (fiduAmount: BigNumber, usdcAmount: BigNumber) => Promise<any>
  zapStakeToCurve: (fiduAmount: BigNumber, usdcAmount: BigNumber) => Promise<any>
}

export default function useStakingData(): StakingData {
  const sendFromUser = useSendFromUser()
  const erc20Approve = useERC20Approve()
  const erc721Approve = useERC721Approve()

  const {
    goldfinchProtocol,
    pool: _pool,
    user: _user,
    gfi: _gfi,
    stakingRewards: _stakingRewards,
    zapper: _zapper,
    currentBlock,
  } = useContext(AppContext)
  const consistent = useFromSameBlock({setAsLeaf: false}, currentBlock, _pool, _user, _gfi, _stakingRewards, _zapper)
  const pool = consistent?.[0]
  const user = consistent?.[1]
  const gfi = consistent?.[2]
  const stakingRewards = consistent?.[3]
  const zapper = consistent?.[4]

  const [stakedPositions, setStakedPositions] = useState<StakingRewardsPosition[]>([])
  const [fiduStaked, setFiduStaked] = useState(new BigNumber(0))
  const [fiduUnstaked, setFiduUnstaked] = useState(new BigNumber(0))
  const [fiduUSDCCurveStaked, setFiduUSDCCurveStaked] = useState(new BigNumber(0))
  const [fiduUSDCCurveUnstaked, setFiduUSDCCurveUnstaked] = useState(new BigNumber(0))
  const [usdcUnstaked, setUSDCUnstaked] = useState(new BigNumber(0))
  const [estimatedCurveStakingApy, setEstimatedCurveStakingApy] = useState<BigNumber>(new BigNumber(0))
  const [estimatedTotalCurveStakingApy, setEstimatedTotalCurveStakingApy] = useState<BigNumber>(new BigNumber(0))
  const [estimatedFiduStakingApy, setEstimatedFiduStakingApy] = useState<BigNumber>(new BigNumber(0))
  const [fiduSharePrice, setFiduSharePrice] = useState(new BigNumber(0))

  useEffect(() => {
    if (pool && user && currentBlock) {
      setUnstakedData()
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBlock, pool, user])

  useEffect(() => {
    if (currentBlock && pool && stakingRewards && gfi && user) {
      setStakedData()
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBlock, pool, stakingRewards, gfi, user])

  useEffect(() => {
    if (stakingRewards && gfi) {
      // The virtual price of a Curve LP token (denominated in 1e18)
      const curveLPTokenPrice = stakingRewards.info.value.curveLPTokenPrice
      // The amount of GFI earned in a year per FIDU staked (denominated in 1e18)
      const currentEarnRatePerYearPerFidu = stakingRewards.info.value.currentEarnRate.multipliedBy(ONE_YEAR_SECONDS)
      // The amount of GFI earned in a year per Curve LP token staked (denominated in 1e18)
      const currentEarnRatePerYearPerCurveToken = currentEarnRatePerYearPerFidu
        // Apply the exchange rate. The exchange rate is denominated in 1e18, so divide by 1e18 to keep the original denomination.
        .multipliedBy(stakingRewards.info.value.curveLPTokenExchangeRate)
        .div(APY_DECIMALS)
        // Apply the multiplier. The multiplier is denominated in 1e18, so divide by 1e18 to keep the original denomination.
        .multipliedBy(stakingRewards.info.value.curveLPTokenMultiplier)
        .div(APY_DECIMALS)

      const estimatedApyFromGfi =
        // Convert the amount of GFI earned in a year per Curve LP token staked to a dollar amount using the current GFI price
        gfiToDollarsAtomic(currentEarnRatePerYearPerCurveToken, gfi.info.value.price)?.dividedBy(GFI_DECIMALS)
      const estimatedTotalApyFromGfi = estimatedApyFromGfi?.multipliedBy(APY_DECIMALS).dividedBy(curveLPTokenPrice)
      setEstimatedCurveStakingApy(estimatedApyFromGfi || new BigNumber(0))
      setEstimatedTotalCurveStakingApy(estimatedTotalApyFromGfi || new BigNumber(0))
    }
  }, [currentBlock, stakingRewards, gfi])

  async function setStakedData() {
    assertNonNullable(pool)
    assertNonNullable(stakingRewards)
    assertNonNullable(gfi)
    assertNonNullable(user)

    const capitalProviderData = await fetchCapitalProviderData(pool, stakingRewards, gfi, user)

    const unstakeablePositions = capitalProviderData.value.unstakeablePositions
    setStakedPositions(unstakeablePositions)

    const unstakeableFiduPositions = unstakeablePositions.filter(
      (position) => position.storedPosition.positionType === StakedPositionType.Fidu
    )
    const unstakeableCurvePositions = unstakeablePositions.filter(
      (position) => position.storedPosition.positionType === StakedPositionType.CurveLP
    )

    setFiduStaked(
      unstakeableFiduPositions.reduce((total, position) => {
        return total.plus(position.storedPosition.amount)
      }, new BigNumber(0))
    )
    setFiduUSDCCurveStaked(
      unstakeableCurvePositions.reduce((total, position) => {
        return total.plus(position.storedPosition.amount)
      }, new BigNumber(0))
    )

    setFiduSharePrice(new BigNumber(pool.info.value.poolData.sharePrice))
    setEstimatedFiduStakingApy(pool.info.value.poolData.estimatedApyFromGfi || new BigNumber(0))
  }

  async function setUnstakedData() {
    assertNonNullable(stakingRewards)
    assertNonNullable(pool)
    assertNonNullable(user)
    const unstakedFidu = new BigNumber(
      await pool.fidu.userWallet.methods.balanceOf(user.address).call(undefined, "latest")
    )

    const unstakedCurve = new BigNumber(
      await stakingRewards.curveLPToken.userWallet.methods.balanceOf(user.address).call(undefined, "latest")
    )
    const unstakedUSDC = new BigNumber(
      await pool.usdc.userWallet.methods.balanceOf(user.address).call(undefined, "latest")
    )

    setFiduUnstaked(unstakedFidu)
    setFiduUSDCCurveUnstaked(unstakedCurve)
    setUSDCUnstaked(unstakedUSDC)
  }

  /**
   * Create a new staked position. Handles token approvals if necessary.
   *
   * Calls the StakingRewards#stake function.
   *
   * @param amount Amount to stake (denominated in the decimals for the staked position type)
   * @param positionType The type of staking position (FIDU/FIDU-USDC-F/etc)
   */
  async function stake(amount: BigNumber, positionType: StakedPositionType): Promise<void> {
    assertNonNullable(stakingRewards)
    assertNonNullable(user)

    const ticker: Ticker = positionTypeToTicker(positionType)

    return erc20Approve(amount, ticker, stakingRewards.address).then(() =>
      sendFromUser(
        stakingRewards.contract.userWallet.methods.stake(amount.toString(10), positionType),
        {
          type: STAKE_TX_TYPE,
          data: {
            amount: toDecimalString(amount, ticker),
            ticker: getERC20Metadata(ticker).ticker.toString(),
          },
        },
        {rejectOnError: true}
      )
    )
  }

  /**
   * Unstake a staked position. Handles unstaking amounts across multiple staked positions.
   *
   * Calls the StakingRewards#unstakeMultiple function.
   *
   * @param amount Amount to stake (denominated in the decimals for the staked position type)
   * @param positionType The type of staking position (FIDU/FIDU-USDC-F/etc)
   */
  async function unstake(amount: BigNumber, positionType: StakedPositionType): Promise<void> {
    assertNonNullable(stakingRewards)

    const ticker = positionTypeToTicker(positionType)
    const optimalPositionsToUnstake = getOptimalPositionsToUnstake(amount, positionType)

    console.log(optimalPositionsToUnstake)

    for (const {tokenId, amount} of optimalPositionsToUnstake) {
      assertNonNullable(tokenId)
      assertNonNullable(amount)
      await sendFromUser(
        stakingRewards.contract.userWallet.methods.unstake(tokenId, amount.toString(10)),
        {
          type: UNSTAKE_TX_TYPE,
          data: {
            totalAmount: toDecimalString(amount, ticker),
            ticker: ticker.toString(),
          },
        },
        {rejectOnError: true}
      )
    }
  }

  /**
   * Deposits FIDU and/or USDC to Curve. Handles token approvals if necessary.
   *
   * Calls the StakingRewards#depositToCurve function.
   *
   * @param fiduAmount Amount of FIDU to deposit (denominated in FIDU decimals - 1e18)
   * @param usdcAmount Amount of USDC to deposit (denominated in USDC decimals - 1e6)
   */
  async function depositToCurve(fiduAmount: BigNumber, usdcAmount: BigNumber): Promise<void> {
    assertNonNullable(stakingRewards)

    return erc20Approve(fiduAmount, Ticker.FIDU, stakingRewards.address)
      .then(() => erc20Approve(usdcAmount, Ticker.USDC, stakingRewards.address))
      .then(() =>
        sendFromUser(
          stakingRewards.contract.userWallet.methods.depositToCurve(fiduAmount.toString(10), usdcAmount.toString(10)),
          {
            type: DEPOSIT_TO_CURVE_TX_TYPE,
            data: {
              fiduAmount: toDecimalString(fiduAmount, Ticker.FIDU),
              usdcAmount: toDecimalString(usdcAmount, Ticker.USDC),
            },
          },
          {rejectOnError: true}
        )
      )
      .then(() => promptUserToAddTokenToWalletIfNecessary(Ticker.CURVE_FIDU_USDC))
  }

  /**
   * Deposits FIDU and/or USDC to Curve and stakes the resulting Curve LP tokens. Handles token approvals if necessary.
   *
   * Calls the StakingRewards#depositToCurveAndStake function.
   *
   * @param fiduAmount Amount of FIDU to deposit (denominated in FIDU decimals - 1e18)
   * @param usdcAmount Amount of USDC to deposit (denominated in USDC decimals - 1e6)
   */
  async function depositToCurveAndStake(fiduAmount: BigNumber, usdcAmount: BigNumber): Promise<void> {
    assertNonNullable(stakingRewards)

    return erc20Approve(fiduAmount, Ticker.FIDU, stakingRewards.address)
      .then(() => erc20Approve(usdcAmount, Ticker.USDC, stakingRewards.address))
      .then(() =>
        sendFromUser(
          stakingRewards.contract.userWallet.methods.depositToCurveAndStake(
            fiduAmount.toString(10),
            usdcAmount.toString(10)
          ),
          {
            type: DEPOSIT_TO_CURVE_AND_STAKE_TX_TYPE,
            data: {
              fiduAmount: toDecimalString(fiduAmount, Ticker.FIDU),
              usdcAmount: toDecimalString(usdcAmount, Ticker.USDC),
            },
          },
          {rejectOnError: true}
        )
      )
      .then(() => promptUserToAddTokenToWalletIfNecessary(Ticker.CURVE_FIDU_USDC))
  }

  /**
   * Migrates staked FIDU and deposits USDC to Curve, and stakes the resulting Curve LP tokens.
   * Handles token approvals if necessary.
   *
   * Calls the Zapper#zapStakeToCurve function.
   *
   * @param fiduAmount Amount of FIDU to migrate (denominated in FIDU decimals - 1e18)
   * @param usdcAmount Amount of USDC to deposit (denominated in USDC decimals - 1e6)
   */
  async function zapStakeToCurve(fiduAmount: BigNumber, usdcAmount: BigNumber): Promise<void> {
    assertNonNullable(stakedPositions)
    assertNonNullable(zapper)
    assertNonNullable(stakingRewards)

    const optimalPositionsToUnstake = getOptimalPositionsToUnstake(fiduAmount, StakedPositionType.Fidu)

    await erc721Approve(stakingRewards, zapper.address)
    await erc20Approve(usdcAmount, Ticker.USDC, zapper.address)

    for (const position of optimalPositionsToUnstake) {
      const usdcEquivalent = position.amount
        .times(fiduSharePrice)
        .div(getMultiplierDecimals(Ticker.FIDU))
        .div(getMultiplierDecimals(Ticker.FIDU))
        .times(getMultiplierDecimals(Ticker.USDC))

      await sendFromUser(
        zapper.contract.userWallet.methods.zapStakeToCurve(
          position.tokenId,
          position.amount.toFixed(0),
          usdcEquivalent.toFixed(0)
        ),
        {
          type: ZAP_STAKE_TO_CURVE_TX_TYPE,
          data: {
            fiduAmount: toDecimalString(position.amount, Ticker.FIDU),
            usdcAmount: toDecimalString(usdcEquivalent, Ticker.USDC),
          },
        },
        {rejectOnError: true}
      )
    }

    await promptUserToAddTokenToWalletIfNecessary(Ticker.CURVE_FIDU_USDC)
  }

  function promptUserToAddTokenToWalletIfNecessary(ticker: Ticker) {
    assertNonNullable(goldfinchProtocol)

    const shouldPromptUserToAddToWallet = fiduUSDCCurveStaked.isZero() && fiduUSDCCurveUnstaked.isZero()
    if (shouldPromptUserToAddToWallet) {
      requestUserAddERC20TokenToWallet(ticker, goldfinchProtocol)
    } else {
      // Don't ask the user to add the token to their wallet, as for Metamask this was
      // observed to prompt the user with another dialog even if the token was already an asset in
      // their wallet -- in which case Metamask includes this warning in the dialog:
      // "This action will edit tokens that are already listed in your wallet, which can
      // be used to phish you. Only approve if you are certain that you mean to change
      // what these tokens represent." Seems better to optimize for not triggering this UX,
      // which will possibly concern the user (even though it need not; a better-designed
      // Metamask would detect that the token contract address in the request is equal to the
      // address of the asset already in the wallet, and not show such a warning, or not
      // show the dialog at all...), than to be aggressive about getting the user to add
      // the asset to their wallet.
    }
  }

  /**
   * Given a total amount to unstake, calculates the optimal positions to unstake from.
   *
   * @param amount Total amount to unstake (denominated in the decimals for the staked position type)
   * @param positionType The type of staking position (FIDU/FIDU-USDC-F/etc)
   */
  function getOptimalPositionsToUnstake(
    amount: BigNumber,
    positionType: StakedPositionType
  ): {tokenId: string; amount: BigNumber}[] {
    assertNonNullable(stakedPositions)
    assertNonNullable(stakingRewards)

    const unstakeableAmount = stakedPositions
      .filter((position) => position.storedPosition.positionType === positionType)
      .reduce((total, position) => total.plus(position.storedPosition.amount), new BigNumber(0))

    if (unstakeableAmount.isLessThan(amount)) {
      throw new AssertionError(`Cannot unstake more than ${unstakeableAmount}.`)
    }

    // To be user-friendly, we exit these positions in reverse order of their vesting
    // end time; positions whose rewards vesting schedule has not completed will be exited before positions whose
    // rewards vesting schedule has completed, which is desirable for the user as that maximizes the rate at which
    // they continue to earn vested (i.e. claimable) rewards. Also, note that among the (unstakeable) positions
    // whose rewards vesting schedule has completed, there is no reason to prefer exiting one position versus
    // another, as all such positions earn rewards at the same rate.
    const sortedUnstakeablePositions = stakedPositions
      .filter((position) => position.storedPosition.positionType === positionType)
      .slice()
      .sort((a, b) => b.storedPosition.rewards.endTime - a.storedPosition.rewards.endTime)

    let amountRemaining = new BigNumber(amount)

    return sortedUnstakeablePositions
      .reduce((acc: {tokenId: string; amount: BigNumber}[], position) => {
        const tokenId = position.tokenId
        const positionAmount = position.storedPosition.amount

        const amountToUnstake = BigNumber.min(positionAmount, amountRemaining)
        amountRemaining = amountRemaining.minus(amountToUnstake)

        return acc.concat([{tokenId, amount: amountToUnstake}])
      }, [])
      .filter(({amount}) => amount.isGreaterThan(new BigNumber(0)))
  }

  return {
    fiduStaked,
    fiduUnstaked,
    fiduUSDCCurveStaked,
    fiduUSDCCurveUnstaked,
    usdcUnstaked,
    estimatedFiduStakingApy,
    estimatedCurveStakingApy,
    estimatedTotalCurveStakingApy,
    fiduSharePrice,
    stake,
    unstake,
    depositToCurve,
    depositToCurveAndStake,
    zapStakeToCurve,
  }
}
