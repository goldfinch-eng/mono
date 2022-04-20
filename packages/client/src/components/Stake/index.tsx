import styled from "styled-components"
import {getERC20Metadata, Ticker} from "../../ethereum/erc20"
import {StakedPositionType} from "../../ethereum/pool"
import useStakingData from "../../hooks/useStakingData"
import ConnectionNotice from "../connectionNotice"
import StakingCard from "./StakingCard"
import {HeaderGrid as StakingHeaderGrid, HeaderText as StakingHeaderText} from "./StakingCardHeader"
import {HeaderGrid as LPAndStakeHeaderGrid, HeaderText as LPAndStakeHeaderText} from "./LPAndStakeCardHeader"
import LPAndStakeCard from "./LPAndStakeCard"
import BigNumber from "bignumber.js"
import {Platform} from "./StakingToken"
import StakingCardMigrateToCurveForm from "./StakingCardMigrateToCurveForm"

const StyledStakingHeaderText = styled(StakingHeaderText)`
  font-size: 16px;
  color: #b4ada7;
`

const StyledLPAndStakeHeaderText = styled(LPAndStakeHeaderText)`
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
    stake,
    unstake,
    zapStakeToCurve,
    depositToCurve,
    depositToCurveAndStake,
  } = useStakingData()

  return (
    <div className="content-section">
      <div className="page-header">
        <div>Stake</div>
      </div>
      <ConnectionNotice requireUnlock={false} />
      <StakingHeaderGrid>
        <StyledStakingHeaderText justifySelf="start" hideOnSmallerScreens={false}>
          Token to stake
        </StyledStakingHeaderText>
        <StyledStakingHeaderText justifySelf="end" hideOnSmallerScreens={false}>
          Rewards APY
        </StyledStakingHeaderText>
        <StyledStakingHeaderText justifySelf="end" hideOnSmallerScreens>
          Available to stake
        </StyledStakingHeaderText>
        <StyledStakingHeaderText justifySelf="end" hideOnSmallerScreens>
          Staked
        </StyledStakingHeaderText>
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
        stake={(amount) => stake(amount, StakedPositionType.CurveLP)}
        unstake={(amount) => unstake(amount, StakedPositionType.CurveLP)}
      />
      <div className="page-header">
        <div>LP on Curve</div>
      </div>
      <LPAndStakeHeaderGrid>
        <StyledLPAndStakeHeaderText justifySelf="start" hideOnSmallerScreens={false}>
          Token exchange
        </StyledLPAndStakeHeaderText>
        <StyledLPAndStakeHeaderText justifySelf="end" hideOnSmallerScreens={false}>
          Staking APY
        </StyledLPAndStakeHeaderText>
        <StyledLPAndStakeHeaderText justifySelf="end" hideOnSmallerScreens>
          Available to LP
        </StyledLPAndStakeHeaderText>
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
        deposit={(amount) => depositToCurve(amount, new BigNumber(0))}
        depositAndStake={(amount) => depositToCurveAndStake(amount, new BigNumber(0))}
      />
      <LPAndStakeCard
        key="LPAndStakeCard-usdc"
        depositToken={getERC20Metadata(Ticker.USDC)}
        poolToken={getERC20Metadata(Ticker.CURVE_FIDU_USDC)}
        maxAmountToDeposit={usdcUnstaked}
        rewardApy={estimatedCurveStakingApy}
        rewardToken={getERC20Metadata(Ticker.GFI)}
        platform={Platform.Curve}
        deposit={(amount) => depositToCurve(new BigNumber(0), amount)}
        depositAndStake={(amount) => depositToCurveAndStake(new BigNumber(0), amount)}
      />
    </div>
  )
}
