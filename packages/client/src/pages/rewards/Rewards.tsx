import React, {useState} from "react"
import _ from "lodash"
import BigNumber from "bignumber.js"
import {Link} from "react-router-dom"
import {gfiFromAtomic} from "../../ethereum/gfi"
import {useGFIBalance, useRewards} from "../../hooks/useStakingRewards"
import {displayDollars, displayNumber} from "../../utils"
import {iconCarrotDown, iconCarrotUp, iconOutArrow} from "../../components/icons"
import {useMediaQuery} from "react-responsive"
import {WIDTH_TYPES} from "../../components/styleConstants"
import EtherscanLink from "../../components/etherscanLink"

import {
  DetailsContainer,
  ColumnsContainer,
  Detail,
  DetailLabel,
  DetailValue,
  Column,
  EtherscanLinkContainer,
} from "./styles"
import {CommunityRewardsVesting, MerkleDistributor} from "../../ethereum/communityRewards"
import {StakedPosition, StakingRewards} from "../../ethereum/pool"

interface RewardsSummaryProps {
  claimable: BigNumber | undefined
  unvested: BigNumber | undefined
  totalGFI: BigNumber | undefined
  totalUSD: BigNumber | undefined
  walletBalance: BigNumber | undefined
}

function RewardsSummary(props: RewardsSummaryProps) {
  const claimable = props.claimable || new BigNumber(0)
  const unvested = props.unvested || new BigNumber(0)
  const totalGFI = props.totalGFI || new BigNumber(0)
  const totalUSD = props.totalUSD || new BigNumber(0)
  const walletBalance = props.walletBalance || new BigNumber(0)

  return (
    <div className="rewards-summary background-container">
      <div className="rewards-summary-left-item">
        <span className="total-gfi-balance">Total GFI balance</span>
        <span className="total-gfi">{displayNumber(gfiFromAtomic(totalGFI), 2)}</span>
        <span className="total-usd">{displayDollars(totalUSD)}</span>
      </div>

      <div className="rewards-summary-right-item">
        <div className="details-item">
          <span>Wallet balance</span>
          <div>
            <span className="value">{displayNumber(gfiFromAtomic(walletBalance), 2)}</span>
            <span>GFI</span>
          </div>
        </div>
        <div className="details-item">
          <span>Claimable</span>
          <div>
            <span className="value">{displayNumber(gfiFromAtomic(claimable), 2)}</span>
            <span>GFI</span>
          </div>
        </div>
        <div className="details-item">
          <span>Still vesting</span>
          <div>
            <span className="value">{displayNumber(gfiFromAtomic(unvested), 2)}</span>
            <span>GFI</span>
          </div>
        </div>
        <div className="details-item total-balance">
          <span>Total balance</span>
          <div>
            <span className="value">{displayNumber(gfiFromAtomic(totalGFI), 2)}</span>
            <span>GFI</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function NoRewards() {
  return (
    <li className="table-row rewards-list-item no-rewards background-container">
      You have no rewards. You can earn rewards by supplying to&nbsp;
      <Link to="/pools/senior">
        <span className="senior-pool-link">pools</span>
      </Link>
      .
    </li>
  )
}

interface ActionButtonProps {
  disabled?: boolean
  onClick: () => void
  text: string
}

function ActionButton(props: ActionButtonProps) {
  const isTabletOrMobile = useMediaQuery({query: `(max-width: ${WIDTH_TYPES.screenL})`})
  const disabledClass = props.disabled ? "disabled-button" : ""

  function handleClick(e) {
    e.stopPropagation()
    props.onClick()
  }

  return (
    <button className={`${!isTabletOrMobile && "table-cell"} action ${disabledClass}`} onClick={handleClick}>
      {props.text}
    </button>
  )
}

interface OpenDetailsProps {
  open: boolean
}

function OpenDetails(props: OpenDetailsProps) {
  if (props.open) {
    return <button className="expand close">{iconCarrotUp}</button>
  }

  return <button className="expand">{iconCarrotDown}</button>
}

interface DetailsProps {
  open: boolean
  disabled: boolean
  transactionDetails: string
  vestingSchedule: string
  claimStatus: string
  currentEarnRate: string
  vestingStatus: string
  etherscanAddress: string
}

function Details(props: DetailsProps) {
  return (
    <DetailsContainer open={props.open} disabled={props.disabled}>
      <ColumnsContainer>
        <Column>
          <Detail>
            <DetailLabel>Transaction details</DetailLabel>
            <DetailValue>{props.transactionDetails}</DetailValue>
          </Detail>
          <Detail>
            <DetailLabel>Vesting schedule</DetailLabel>
            <DetailValue>{props.vestingSchedule}</DetailValue>
          </Detail>
          <Detail>
            <DetailLabel>Claim status</DetailLabel>
            <DetailValue>{props.claimStatus}</DetailValue>
          </Detail>
        </Column>
        <Column>
          <Detail>
            <DetailLabel>Current earn rate</DetailLabel>
            <DetailValue>{props.currentEarnRate}</DetailValue>
          </Detail>
          <Detail>
            <DetailLabel>Vesting status</DetailLabel>
            <DetailValue>{props.vestingStatus}</DetailValue>
          </Detail>
        </Column>
      </ColumnsContainer>
      <EtherscanLinkContainer className="pool-links">
        <EtherscanLink address={props.etherscanAddress}>
          Etherscan<span className="outbound-link">{iconOutArrow}</span>
        </EtherscanLink>
      </EtherscanLinkContainer>
    </DetailsContainer>
  )
}

interface RewardsListItemProps {
  isAcceptRequired: boolean
  title: string
  grantedGFI: BigNumber
  claimableGFI: BigNumber
}

function RewardsListItem(props: RewardsListItemProps) {
  const [accepted, setAccepted] = useState(!props.isAcceptRequired)
  const [open, setOpen] = useState<boolean>(false)
  const isTabletOrMobile = useMediaQuery({query: `(max-width: ${WIDTH_TYPES.screenL})`})

  function handleAccept() {
    setAccepted(!accepted)
  }

  const valueDisabledClass = !accepted ? "disabled-text" : ""

  const actionButtonComponent = !accepted ? (
    <ActionButton text="Accept" onClick={handleAccept} />
  ) : (
    <ActionButton text="Claim GFI" onClick={() => console.error("error")} disabled={props.claimableGFI.eq(0)} />
  )

  // TODO: remove when using real data
  const fakeDetailsObject = {
    transactionDetails: "16,179.69 FIDU staked on Nov 1, 2021",
    vestingSchedule: "Linear until 100% on Nov 1, 2022",
    claimStatus: "0 GFI claimed of your total vested 4.03 GFI",
    currentEarnRate: "+10.21 granted per week",
    vestingStatus: "8.0% (4.03 GFI) vested so far",
    etherscanAddress: "",
  }

  return (
    <>
      {isTabletOrMobile ? (
        <li onClick={() => setOpen(!open)}>
          <div className="rewards-list-item background-container clickable mobile">
            <div className="item-header">
              <div>{props.title}</div>
              <OpenDetails open={open} />
            </div>
            <div className="item-details">
              <div className="detail-container">
                <span className="detail-label">Granted GFI</span>
                <div className={`${valueDisabledClass}`}>{displayNumber(gfiFromAtomic(props.grantedGFI), 2)}</div>
              </div>
              <div className="detail-container">
                <span className="detail-label">Claimable GFI</span>
                <div className={`${valueDisabledClass}`}>{displayNumber(gfiFromAtomic(props.claimableGFI), 2)}</div>
              </div>
            </div>
            {actionButtonComponent}
          </div>
          {open && (
            <Details
              open={open}
              disabled={props.claimableGFI.eq(0)}
              transactionDetails={fakeDetailsObject.transactionDetails}
              vestingSchedule={fakeDetailsObject.vestingSchedule}
              claimStatus={fakeDetailsObject.claimStatus}
              currentEarnRate={fakeDetailsObject.currentEarnRate}
              vestingStatus={fakeDetailsObject.vestingStatus}
              etherscanAddress={fakeDetailsObject.etherscanAddress}
            />
          )}
        </li>
      ) : (
        <li onClick={() => setOpen(!open)}>
          <div className="rewards-list-item table-row background-container clickable">
            <div className="table-cell col32">{props.title}</div>
            <div className={`table-cell col20 numeric ${valueDisabledClass}`}>
              {displayNumber(gfiFromAtomic(props.grantedGFI), 2)}
            </div>
            <div className={`table-cell col20 numeric ${valueDisabledClass}`}>
              {displayNumber(gfiFromAtomic(props.claimableGFI), 2)}
            </div>
            {actionButtonComponent}
            <OpenDetails open={open} />
          </div>
          {open && (
            <Details
              open={open}
              disabled={props.claimableGFI.eq(0)}
              transactionDetails={fakeDetailsObject.transactionDetails}
              vestingSchedule={fakeDetailsObject.vestingSchedule}
              claimStatus={fakeDetailsObject.claimStatus}
              currentEarnRate={fakeDetailsObject.currentEarnRate}
              vestingStatus={fakeDetailsObject.vestingStatus}
              etherscanAddress={fakeDetailsObject.etherscanAddress}
            />
          )}
        </li>
      )}
    </>
  )
}

function getSortedRewards(
  stakingRewards: StakingRewards | undefined,
  merkleDistributor: MerkleDistributor | undefined
): (StakedPosition | CommunityRewardsVesting)[] {
  /* NOTE: First order by 0 or >0 claimable rewards (0 claimable at the bottom), then group by type
   (e.g. all the staking together, then all the airdrops), then order by most recent first */
  const stakes = stakingRewards?.positions || []
  const airdrops = merkleDistributor?.communityRewards?.grants || []

  const rewards: (StakedPosition | CommunityRewardsVesting)[] = [...stakes, ...airdrops]
  rewards.sort((i1, i2) => {
    let val = i1.claimable.minus(i2.claimable)
    if (!val.isZero()) return val.isPositive() ? -1 : 1

    if (i1 instanceof StakedPosition && i2 instanceof CommunityRewardsVesting) {
      return 1
    }

    if (i1 instanceof CommunityRewardsVesting && i2 instanceof StakedPosition) {
      return -1
    }

    if (i1 instanceof StakedPosition && i2 instanceof StakedPosition) {
      return i2.rewards.startTime - i1.rewards.startTime
    }

    return i2.rewards.startTime - i1.rewards.startTime
  })
  return rewards
}

function capitalizeMerkleDistributorGrantReason(reason: string): string {
  return reason
    .split("_")
    .map((s) => _.startCase(s))
    .join(" ")
}

function Rewards(props) {
  const isTabletOrMobile = useMediaQuery({query: `(max-width: ${WIDTH_TYPES.screenL})`})
  const {stakingRewards, merkleDistributor} = useRewards()
  const gfiBalance = useGFIBalance()

  let claimable: BigNumber | undefined
  let unvested: BigNumber | undefined
  let granted: BigNumber | undefined
  if (stakingRewards?.totalClaimable || merkleDistributor?.totalClaimable) {
    let val = stakingRewards?.totalClaimable || new BigNumber(0)
    claimable = val.plus(merkleDistributor?.totalClaimable || new BigNumber(0))
  }

  if (stakingRewards?.unvested || merkleDistributor?.unvested) {
    let val = stakingRewards?.unvested || new BigNumber(0)
    unvested = val.plus(merkleDistributor?.unvested || new BigNumber(0))
  }

  if (stakingRewards?.granted || merkleDistributor?.granted) {
    let val = stakingRewards?.granted || new BigNumber(0)
    granted = val.plus(merkleDistributor?.granted || new BigNumber(0))
  }

  const rewards = getSortedRewards(stakingRewards, merkleDistributor)
  const emptyRewards =
    (!merkleDistributor?.communityRewards.grants || !merkleDistributor?.communityRewards.grants.length) &&
    (!merkleDistributor?.actionRequiredAirdrops || !merkleDistributor?.actionRequiredAirdrops.length) &&
    (!stakingRewards?.positions || !stakingRewards?.positions.length)
  return (
    <div className="content-section">
      <div className="page-header">
        <h1>Rewards</h1>
      </div>

      <RewardsSummary
        claimable={claimable}
        unvested={unvested}
        totalGFI={granted}
        totalUSD={
          // TODO: this needs to be updated once we have a price for GFI in USD.
          undefined
        }
        walletBalance={gfiBalance}
      />

      <div className="gfi-rewards table-spaced">
        <div className="table-header background-container-inner">
          <h2 className="table-cell col32 title">GFI Rewards</h2>
          {!isTabletOrMobile && (
            <>
              <div className="table-cell col20 numeric balance break-granted-column">Granted GFI</div>
              <div className="table-cell col20 numeric limit break-claimable-column">Claimable GFI</div>
            </>
          )}
        </div>
        <ul className="rewards-list">
          {merkleDistributor?.loaded && stakingRewards?.loaded && emptyRewards ? (
            <NoRewards />
          ) : (
            <>
              {rewards &&
                rewards.map((item) => {
                  return (
                    <RewardsListItem
                      key={`reward-${item.rewards.startTime}`}
                      isAcceptRequired={false}
                      title={item.reason}
                      grantedGFI={item.granted}
                      claimableGFI={item.claimable}
                    />
                  )
                })}

              {merkleDistributor?.actionRequiredAirdrops &&
                merkleDistributor.actionRequiredAirdrops.map((item) => (
                  <RewardsListItem
                    key={`${item.reason}-${item.index}`}
                    isAcceptRequired={true}
                    title={capitalizeMerkleDistributorGrantReason(item.reason)}
                    grantedGFI={new BigNumber(item.grant.amount)}
                    claimableGFI={new BigNumber(0)}
                  />
                ))}
            </>
          )}
        </ul>
      </div>
    </div>
  )
}

export default Rewards
