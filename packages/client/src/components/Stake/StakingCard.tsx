import BigNumber from "bignumber.js"
import {useState} from "react"
import styled from "styled-components"
import {ERC20Metadata} from "../../ethereum/erc20"
import StakingCardForm from "./StakingCardForm"
import StakingCardHeader from "./StakingCardHeader"

type StakingCardProps = {
  token: ERC20Metadata
  maxAmountToStake: BigNumber
  maxAmountToUnstake: BigNumber
  rewardApy: BigNumber
  rewardToken: ERC20Metadata
  stake: (BigNumber) => Promise<any>
  unstake: (BigNumber) => Promise<any>
  migrate?: (BigNumber) => Promise<any>
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
  stake,
  unstake,
  migrate,
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
        onToggle={onToggle}
      />
      {expanded && (
        <StakingCardForm
          token={token}
          maxAmountToStake={maxAmountToStake}
          maxAmountToUnstake={maxAmountToUnstake}
          stake={stake}
          unstake={unstake}
          migrate={migrate}
        />
      )}
    </div>
  )
}
