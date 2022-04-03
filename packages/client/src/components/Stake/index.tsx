import styled from "styled-components"
import {getERC20Metadata, Ticker} from "../../ethereum/erc20"
import {StakedPositionType} from "../../ethereum/pool"
import useStakingData from "../../hooks/useStakingData"
import ConnectionNotice from "../connectionNotice"
import StakingCard from "./StakingCard"
import {HeaderGrid as StakingHeaderGrid, HeaderText as StakingHeaderText} from "./StakingCardHeader"

const StyledStakingHeaderText = styled(StakingHeaderText)`
  font-size: 16px;
  color: #b4ada7;
`

export default function Stake() {
  const {
    fiduStaked,
    fiduUnstaked,
    fiduUSDCCurveStaked,
    fiduUSDCCurveUnstaked,
    estimatedFiduStakingApy,
    estimatedCurveStakingApy,
    stake,
    unstake,
    zapStakeToCurve,
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
        token={getERC20Metadata(Ticker.FIDU)}
        maxAmountToUnstake={fiduStaked}
        maxAmountToStake={fiduUnstaked}
        rewardApy={estimatedFiduStakingApy}
        rewardToken={getERC20Metadata(Ticker.GFI)}
        stake={(amount) => stake(amount, StakedPositionType.Fidu)}
        unstake={(amount) => unstake(amount, StakedPositionType.Fidu)}
        migrate={(amount) => zapStakeToCurve(amount)}
      />
      <StakingCard
        token={getERC20Metadata(Ticker.CURVE_FIDU_USDC)}
        maxAmountToUnstake={fiduUSDCCurveStaked}
        maxAmountToStake={fiduUSDCCurveUnstaked}
        rewardApy={estimatedCurveStakingApy}
        rewardToken={getERC20Metadata(Ticker.GFI)}
        stake={(amount) => stake(amount, StakedPositionType.CurveLP)}
        unstake={(amount) => unstake(amount, StakedPositionType.CurveLP)}
      />
    </div>
  )
}
