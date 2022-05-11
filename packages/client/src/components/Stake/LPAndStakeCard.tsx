import BigNumber from "bignumber.js"
import {useState} from "react"
import styled from "styled-components"
import {ERC20Metadata} from "../../ethereum/erc20"
import {Slippage} from "../../hooks/useCurvePool"
import LPAndStakeCardForm from "./LPAndStakeCardForm"
import LPAndStakeCardHeader from "./LPAndStakeCardHeader"
import {Platform} from "./StakingToken"

type LPAndStakeCardProps = {
  // Token to deposit
  depositToken: ERC20Metadata
  // LP token received in exchange
  poolToken: ERC20Metadata
  // Max amount available to deposit (denominated in depositToken decimals)
  maxAmountToDeposit: BigNumber
  // Reward APY when LP token is staked
  rewardApy: BigNumber
  // Reward token received when LP token is staked
  rewardToken: ERC20Metadata
  // Platform of the liquidity pool
  platform: Platform
  // Optional APY tooltip. The tooltip will be displayed if this prop exists.
  apyTooltip?: React.ReactNode
  deposit: (BigNumber) => Promise<any>
  depositAndStake: (BigNumber) => Promise<any>
  estimateSlippage: (BigNumber) => Promise<Slippage>
}

const StyledLPAndStakeCardHeader = styled(LPAndStakeCardHeader)<{expanded: boolean}>`
  padding-bottom: ${({expanded}) => (expanded ? "20px" : "0px")};
  border-bottom: ${({expanded}) => (expanded ? "2px #e4e0dd solid" : "none")};
  margin-bottom: ${({expanded}) => (expanded ? "30px" : "0px")};
`

export default function LPAndStakeCard({
  depositToken,
  poolToken,
  maxAmountToDeposit,
  rewardApy,
  rewardToken,
  platform,
  apyTooltip,
  deposit,
  depositAndStake,
  estimateSlippage,
}: LPAndStakeCardProps) {
  const [expanded, setExpanded] = useState<boolean>(false)

  function onToggle() {
    setExpanded(!expanded)
  }

  return (
    <div className="background-container">
      <StyledLPAndStakeCardHeader
        expanded={expanded}
        depositToken={depositToken}
        poolToken={poolToken}
        maxAmountToDeposit={maxAmountToDeposit}
        rewardApy={rewardApy}
        rewardToken={rewardToken}
        platform={platform}
        apyTooltip={apyTooltip}
        onToggle={onToggle}
      />
      {expanded && (
        <LPAndStakeCardForm
          depositToken={depositToken}
          poolToken={poolToken}
          maxAmountToDeposit={maxAmountToDeposit}
          stakingApy={rewardApy}
          deposit={deposit}
          depositAndStake={depositAndStake}
          estimateSlippage={estimateSlippage}
        />
      )}
    </div>
  )
}
