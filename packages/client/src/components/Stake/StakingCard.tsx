import BigNumber from "bignumber.js"
import {useState} from "react"
import styled from "styled-components"
import {ERC20Metadata} from "../../ethereum/erc20"
import StakingCardForm from "./StakingCardForm"
import StakingCardHeader from "./StakingCardHeader"
import {Platform} from "./StakingToken"

type StakingCardProps = {
  // Token to stake
  token: ERC20Metadata
  // Max amount available to stake (denominated in `token` decimals)
  maxAmountToStake: BigNumber
  // Max amount available to unstake (denominated in `token` decimals)
  maxAmountToUnstake: BigNumber
  // Staking reward APY
  rewardApy: BigNumber
  // Reward token recieved for staking
  rewardToken: ERC20Metadata
  // Platform of the staking token
  platform: Platform
  // Optional migrate form. The "Migrate" tab will be displayed if this prop exists.
  migrateForm?: React.ReactNode
  // Optional APY tooltip. The tooltip will be displayed if this prop exists.
  apyTooltip?: React.ReactNode
  stake: (BigNumber) => Promise<any>
  unstake: (BigNumber) => Promise<any>
}

const StyledStakingCardHeader = styled(StakingCardHeader)<{expanded: boolean}>`
  padding-bottom: ${({expanded}) => (expanded ? "20px" : "0px")};
  border-bottom: ${({expanded}) => (expanded ? "2px #e4e0dd solid" : "none")};
  margin-bottom: ${({expanded}) => (expanded ? "30px" : "0px")};
`

export default function StakingCard({
  token,
  maxAmountToStake,
  maxAmountToUnstake,
  rewardApy,
  rewardToken,
  platform,
  apyTooltip,
  stake,
  unstake,
  migrateForm,
}: StakingCardProps) {
  const [expanded, setExpanded] = useState<boolean>(false)

  function onToggle() {
    setExpanded(!expanded)
  }

  return (
    <div className="background-container">
      <StyledStakingCardHeader
        expanded={expanded}
        token={token}
        maxAmountToStake={maxAmountToStake}
        maxAmountToUnstake={maxAmountToUnstake}
        rewardApy={rewardApy}
        rewardToken={rewardToken}
        platform={platform}
        apyTooltip={apyTooltip}
        onToggle={onToggle}
      />
      {expanded && (
        <StakingCardForm
          token={token}
          maxAmountToStake={maxAmountToStake}
          maxAmountToUnstake={maxAmountToUnstake}
          stake={stake}
          unstake={unstake}
          migrateForm={migrateForm}
        />
      )}
    </div>
  )
}
