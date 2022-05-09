import styled from "styled-components"
import {getERC20Metadata, Ticker} from "../../ethereum/erc20"
import {StakedPositionType} from "../../ethereum/pool"
import useStakingData from "../../hooks/useStakingData"
import ConnectionNotice from "../connectionNotice"
import StakingCard from "./StakingCard"
import {HeaderGrid as StakingHeaderGrid, HeaderText} from "./StakingCardHeader"
import {HeaderGrid as LPAndStakeHeaderGrid} from "./LPAndStakeCardHeader"
import LPAndStakeCard from "./LPAndStakeCard"
import BigNumber from "bignumber.js"
import {Platform} from "./StakingToken"
import StakingCardMigrateToCurveForm from "./StakingCardMigrateToCurveForm"
import useCurvePool from "../../hooks/useCurvePool"
import {iconOutArrow} from "../icons"
import CurveStakingAPYTooltip from "./CurveStakingAPYTooltip"

const SectionHeader = styled.div`
  margin-bottom: 0;
  padding-bottom: 12px;
`

const SectionHeaderWithLink = styled(SectionHeader)`
  display: flex;
  justify-content: space-between;
  align-items: center;

  div {
    a {
      font-size: 15px;
      text-decoration: underline;
      color: ${({theme}) => theme.colors.purpDark};
      font-weight: normal;
    }

    .icon {
      display: inline-block;
      margin: 0 0 0 3px;
      vertical-align: top;
      width: 15px;

      path {
        fill: ${({theme}) => theme.colors.purpDark};
      }
    }
  }
`

const SectionSubtitle = styled.div`
  font-size: ${({theme}) => theme.typography.fontSize.sansSizeXs};
  font-weight: normal;
  color: ${({theme}) => theme.colors.purpLight};
  padding-bottom: 36px;
  line-height: 1.3;

  > a {
    color: ${({theme}) => theme.colors.purpLight};
    text-decoration: underline;
  }
`

const StyledHeaderText = styled(HeaderText)`
  font-size: 16px;
  color: #b4ada7;
`

export default function Stake() {
  const {
    fiduStaked,
    fiduUnstaked,
    fiduUSDCCurveStaked,
    fiduUSDCCurveUnstaked,
    usdcUnstaked,
    estimatedFiduStakingApy,
    estimatedCurveStakingApy,
    fiduSharePrice,
    stake,
    unstake,
    zapStakeToCurve,
    depositToCurve,
    depositToCurveAndStake,
  } = useStakingData()

  const {estimateSlippage} = useCurvePool()

  return (
    <div className="content-section">
      <SectionHeader className="page-header">
        <div>Stake on Goldfinch</div>
      </SectionHeader>
      <SectionSubtitle>
        Stake your FIDU, or your LP tokens from providing liquidity to the Curve FIDU-USDC pool, on Goldfinch to earn
        additional GFI rewards. Or, migrate your staked FIDU to the Curve FIDU-USDC pool.{" "}
        <a
          href="https://docs.goldfinch.finance/goldfinch/protocol-mechanics/staking"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn more
        </a>
      </SectionSubtitle>
      <ConnectionNotice requireUnlock={false} />
      <StakingHeaderGrid>
        <StyledHeaderText justifySelf="start" hideOnSmallerScreens={false}>
          Token to stake
        </StyledHeaderText>
        <StyledHeaderText justifySelf="end" hideOnSmallerScreens={false}>
          Est. APY
        </StyledHeaderText>
        <StyledHeaderText justifySelf="end" hideOnSmallerScreens>
          Available to stake
        </StyledHeaderText>
        <StyledHeaderText justifySelf="end" hideOnSmallerScreens>
          Staked
        </StyledHeaderText>
        <div></div>
      </StakingHeaderGrid>
      <StakingCard
        key="StakingCard-fidu"
        token={getERC20Metadata(Ticker.FIDU)}
        maxAmountToUnstake={fiduStaked}
        maxAmountToStake={fiduUnstaked}
        rewardApy={estimatedFiduStakingApy}
        rewardToken={getERC20Metadata(Ticker.GFI)}
        platform={Platform.Goldfinch}
        stake={(amount) => stake(amount, StakedPositionType.Fidu)}
        unstake={(amount) => unstake(amount, StakedPositionType.Fidu)}
        migrateForm={
          <StakingCardMigrateToCurveForm
            maxFiduAmountToMigrate={fiduStaked}
            maxUSDCAmountToDeposit={usdcUnstaked}
            fiduSharePrice={fiduSharePrice}
            migrate={zapStakeToCurve}
          />
        }
      />
      <StakingCard
        key="StakingCard-fidu-usdc"
        token={getERC20Metadata(Ticker.CURVE_FIDU_USDC)}
        maxAmountToUnstake={fiduUSDCCurveStaked}
        maxAmountToStake={fiduUSDCCurveUnstaked}
        rewardApy={estimatedCurveStakingApy}
        rewardToken={getERC20Metadata(Ticker.GFI)}
        platform={Platform.Curve}
        apyTooltip={<CurveStakingAPYTooltip />}
        stake={(amount) => stake(amount, StakedPositionType.CurveLP)}
        unstake={(amount) => unstake(amount, StakedPositionType.CurveLP)}
      />
      <SectionHeaderWithLink className="page-header">
        <div>LP on Curve</div>
        <div className="link">
          <a href="https://curve.fi/factory-crypto/23" target="_blank" rel="noopener noreferrer">
            View pool on Curve<span className="outbound-link">{iconOutArrow}</span>
          </a>
        </div>
      </SectionHeaderWithLink>
      <SectionSubtitle>
        Deposit your unstaked FIDU or USDC into the FIDU-USDC Curve liquidity pool, with the option to stake your
        resulting Curve LP tokens on Goldfinch.{" "}
        <a
          href="https://docs.goldfinch.finance/goldfinch/protocol-mechanics/staking"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn more
        </a>
      </SectionSubtitle>
      <LPAndStakeHeaderGrid>
        <StyledHeaderText justifySelf="start" hideOnSmallerScreens={false}>
          Token to deposit
        </StyledHeaderText>
        <StyledHeaderText justifySelf="end" hideOnSmallerScreens={false}>
          Est. APY
        </StyledHeaderText>
        <StyledHeaderText justifySelf="end" hideOnSmallerScreens>
          Available to deposit
        </StyledHeaderText>
        <div></div>
      </LPAndStakeHeaderGrid>
      <LPAndStakeCard
        key="LPAndStakeCard-fidu"
        depositToken={getERC20Metadata(Ticker.FIDU)}
        poolToken={getERC20Metadata(Ticker.CURVE_FIDU_USDC)}
        maxAmountToDeposit={fiduUnstaked}
        rewardApy={estimatedCurveStakingApy}
        rewardToken={getERC20Metadata(Ticker.GFI)}
        platform={Platform.Curve}
        apyTooltip={<CurveStakingAPYTooltip />}
        deposit={(amount) => depositToCurve(amount, new BigNumber(0))}
        depositAndStake={(amount) => depositToCurveAndStake(amount, new BigNumber(0))}
        estimateSlippage={(fiduAmount) => estimateSlippage(fiduAmount, new BigNumber(0))}
      />
      <LPAndStakeCard
        key="LPAndStakeCard-usdc"
        depositToken={getERC20Metadata(Ticker.USDC)}
        poolToken={getERC20Metadata(Ticker.CURVE_FIDU_USDC)}
        maxAmountToDeposit={usdcUnstaked}
        rewardApy={estimatedCurveStakingApy}
        rewardToken={getERC20Metadata(Ticker.GFI)}
        platform={Platform.Curve}
        apyTooltip={<CurveStakingAPYTooltip />}
        deposit={(amount) => depositToCurve(new BigNumber(0), amount)}
        depositAndStake={(amount) => depositToCurveAndStake(new BigNumber(0), amount)}
        estimateSlippage={(usdcAmount) => estimateSlippage(new BigNumber(0), usdcAmount)}
      />
    </div>
  )
}
