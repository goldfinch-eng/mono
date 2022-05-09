import BigNumber from "bignumber.js"
import styled from "styled-components"
import {ERC20Metadata} from "../../ethereum/erc20"
import {mediaPoint} from "../../styles/mediaPoint"
import {InfoIcon} from "../../ui/icons"
import {displayNumber, displayPercent} from "../../utils"
import {iconCarrotDown, iconCarrotUp} from "../icons"
import LPAndStakeTokens, {Platform} from "./LPAndStakeTokens"
import {APYHeaderText, HeaderText} from "./StakingCardHeader"

type LPAndStakeCardHeaderProps = {
  className?: string
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
  expanded?: boolean
  onToggle: () => any
}

export const HeaderGrid = styled.div`
  display: grid;
  grid-template-columns: 8fr 4fr 4fr 1fr;
  grid-column-gap: 30px;
  align-items: center;

  ${({theme}) => mediaPoint(theme).screenL} {
    grid-template-columns: 6fr 3fr 1fr;
    grid-column-gap: 20px;
  }
`

const ClickableHeaderGrid = styled(HeaderGrid)`
  cursor: pointer;
`

const Carrot = styled.button`
  > .icon {
    width: 20px;
  }
`

export default function LPAndStakeCardHeader({
  className,
  expanded,
  depositToken,
  poolToken,
  maxAmountToDeposit,
  rewardApy,
  rewardToken,
  platform,
  apyTooltip,
  onToggle,
}: LPAndStakeCardHeaderProps) {
  return (
    <ClickableHeaderGrid className={className} onClick={onToggle}>
      <LPAndStakeTokens depositToken={depositToken} poolToken={poolToken} platform={platform} />
      <APYHeaderText justifySelf="end" hideOnSmallerScreens={false}>
        <div>{`${displayPercent(rewardApy)} ${rewardToken.ticker}`}</div>
        {!!apyTooltip && (
          <>
            <div>
              <span
                data-tip=""
                data-for="curve-apy-tooltip"
                data-offset="{'top': 0, 'left': 0}"
                data-place="bottom"
                onClick={(e) => e.stopPropagation()}
              >
                <InfoIcon />
              </span>
            </div>
            {apyTooltip}
          </>
        )}
      </APYHeaderText>
      <HeaderText justifySelf="end" light={maxAmountToDeposit.isZero()} hideOnSmallerScreens>
        {displayNumber(maxAmountToDeposit.div(new BigNumber(10).pow(depositToken.decimals)))}
      </HeaderText>
      <Carrot>{expanded ? iconCarrotUp : iconCarrotDown}</Carrot>
    </ClickableHeaderGrid>
  )
}
