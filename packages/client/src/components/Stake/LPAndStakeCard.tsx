import BigNumber from "bignumber.js"
import {useState} from "react"
import styled from "styled-components"
import {ERC20Metadata} from "../../ethereum/erc20"
import LPAndStakeCardForm from "./LPAndStakeCardForm"
import LPAndStakeCardHeader from "./LPAndStakeCardHeader"

type LPAndStakeCardProps = {
  depositToken: ERC20Metadata
  poolToken: ERC20Metadata
  maxAmountToDeposit: BigNumber
  rewardApy: BigNumber
  rewardToken: ERC20Metadata
  deposit: (BigNumber) => Promise<any>
  depositAndStake: (BigNumber) => Promise<any>
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
  deposit,
  depositAndStake,
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
        onToggle={onToggle}
      />
      {expanded && (
        <LPAndStakeCardForm
          depositToken={depositToken}
          maxAmountToDeposit={maxAmountToDeposit}
          stakingApy={rewardApy}
          deposit={deposit}
          depositAndStake={depositAndStake}
        />
      )}
    </div>
  )
}
