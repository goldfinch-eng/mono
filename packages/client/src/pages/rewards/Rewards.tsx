import React, {useState} from "react"
import {Link} from "react-router-dom"
import {iconCarrotDown, iconCarrotUp} from "../../components/icons"
import {useMediaQuery} from "react-responsive"
import {WIDTH_TYPES} from "../../components/styleConstants"
import styled from "styled-components"

import colors from "../../layout/colors"
import Text from "../../components/text"

const DetailsContainer = styled.div`
  display: flex;
  margin: 0 0 24px 0;
`

const Detail = styled.div`
  display: flex;
  flex-direction: column;
  padding: 0 0 24px 0;

  > * + * {
    margin: 4px 0 0 0;
  }
`

const Column = styled.div`
  width: 100%;
`

const EtherscanLinkContainer = styled.div``

interface RewardsSummaryProps {
  fullyVested: string
  stillVesting: string
  totalGFI: string
  totalUSD: string
  walletBalance: string
}

function RewardsSummary(props: RewardsSummaryProps) {
  return (
    <div className="rewards-summary background-container">
      <div className="rewards-summary-left-item">
        <span className="total-gfi-balance">Total GFI balance</span>
        <span className="total-gfi">{props.totalGFI}</span>
        <span className="total-usd">${props.totalUSD}</span>
      </div>

      <div className="rewards-summary-right-item">
        <div className="details-item">
          <span>Wallet balance</span>
          <div>
            <span className="value">{props.walletBalance}</span>
            <span>GFI</span>
          </div>
        </div>
        <div className="details-item">
          <span>Fully vested</span>
          <div>
            <span className="value">{props.fullyVested}</span>
            <span>GFI</span>
          </div>
        </div>
        <div className="details-item">
          <span>Still vesting</span>
          <div>
            <span className="value">{props.stillVesting}</span>
            <span>GFI</span>
          </div>
        </div>
        <div className="details-item total-balance">
          <span>Total balance</span>
          <div>
            <span className="value">{props.totalGFI}</span>
            <span>GFI</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function NoRewards(props) {
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

function ActionButton(props) {
  const isTabletOrMobile = useMediaQuery({query: `(max-width: ${WIDTH_TYPES.screenXL})`})
  const disabledClass = props.disabled ? "disabled-button" : ""

  return (
    <button className={`${!isTabletOrMobile && "table-cell col16"} action ${disabledClass}`} onClick={props.onClick}>
      {props.text}
    </button>
  )
}

interface RewardsListItemProps {
  isCommunityRewards: boolean
  title: string
  grantedGFI: string
  claimableGFI: string
}

function RewardsListItem(props: RewardsListItemProps) {
  const [accepted, setAccepted] = useState(props.isCommunityRewards ? false : true)
  const [open, setOpen] = useState<boolean>(true)
  const isTabletOrMobile = useMediaQuery({query: `(max-width: ${WIDTH_TYPES.screenXL})`})

  function handleAccept() {
    setAccepted(!accepted)
  }

  const valueDisabledClass = !accepted ? "disabled-text" : ""

  const actionButtonComponent = !accepted ? (
    <ActionButton text="Accept" onClick={handleAccept} />
  ) : (
    <ActionButton
      text="Claim GFI"
      onClick={() => console.log("claim action")}
      disabled={props.claimableGFI === "0.00"}
    />
  )

  return (
    <>
      {!isTabletOrMobile && (
        <li>
          <div className="rewards-list-item table-row background-container clickable">
            <div className="table-cell col32">{props.title}</div>
            <div className={`table-cell col20 numeric ${valueDisabledClass}`}>{props.grantedGFI}</div>
            <div className={`table-cell col20 numeric ${valueDisabledClass}`}>{props.claimableGFI}</div>
            {actionButtonComponent}

            {/* TODO: move this to a component */}
            {open ? (
              <button className="expand close" onClick={() => setOpen(false)}>
                {iconCarrotUp}
              </button>
            ) : (
              <button className="expand" onClick={() => setOpen(true)}>
                {iconCarrotDown}
              </button>
            )}
          </div>
          {open && (
            <DetailsContainer>
              <Column>
                <Detail>
                  <Text color={colors.purpLight} size={15}>
                    Transaction details
                  </Text>
                  <Text color={colors.purpDark} size={18}>
                    16,179.69 FIDU staked on Nov 1, 2021
                  </Text>
                </Detail>
                <Detail>
                  <Text color={colors.purpLight} size={15}>
                    Vesting schedule
                  </Text>
                  <Text color={colors.purpDark} size={18}>
                    Linear until 100% on Nov 1, 2022
                  </Text>
                </Detail>
                <Detail>
                  <Text color={colors.purpLight} size={15}>
                    Claim status
                  </Text>
                  <Text color={colors.purpDark} size={18}>
                    0 GFI claimed of your total vested 4.03 GFI
                  </Text>
                </Detail>
              </Column>
              <Column>
                <Detail>
                  <Text color={colors.purpLight} size={15}>
                    Current earn rate
                  </Text>
                  <Text color={colors.purpDark} size={18}>
                    +10.21 granted per week
                  </Text>
                </Detail>
                <Detail>
                  <Text color={colors.purpLight} size={15}>
                    Vesting status
                  </Text>
                  <Text color={colors.purpDark} size={18}>
                    8.0% (4.03 GFI) vested so far
                  </Text>
                </Detail>
              </Column>
              {/* TODO: use EtherscanLink component */}
              {/* <EtherscanLinkContainer>Etherscan</EtherscanLinkContainer> */}
            </DetailsContainer>
          )}
        </li>
      )}

      {isTabletOrMobile && (
        <li className="rewards-list-item background-container clickable mobile">
          <div className="item-header">
            <div>{props.title}</div>
            <button className="expand">{iconCarrotDown}</button>
          </div>
          <div className="item-details">
            <div className="detail-container">
              <span className="detail-label">Granted GFI</span>
              <div className={`${valueDisabledClass}`}>{props.grantedGFI}</div>
            </div>
            <div className="detail-container">
              <span className="detail-label">Claimable GFI</span>
              <div className={`${valueDisabledClass}`}>{props.claimableGFI}</div>
            </div>
          </div>
          {actionButtonComponent}
        </li>
      )}
    </>
  )
}

function Rewards(props) {
  const isTabletOrMobile = useMediaQuery({query: `(max-width: ${WIDTH_TYPES.screenXL})`})

  // TODO: remove this variable when getting real data
  const gfiRewards = [
    {
      isCommunityRewards: false,
      title: "Staked 16K FIDU on Nov 1",
      grantedGFI: "50.34",
      claimableGFI: "4.03",
    },
    {
      isCommunityRewards: true,
      title: "Flight Academy Reward",
      grantedGFI: "12,500.00",
      claimableGFI: "0.00",
    },
    {
      isCommunityRewards: true,
      title: "Liquidity Provider Airdrop",
      grantedGFI: "100,000.00",
      claimableGFI: "50,000.00",
    },
  ]

  return (
    <div className="content-section">
      <div className="page-header">
        <h1>Rewards</h1>
      </div>

      <RewardsSummary fullyVested="0.00" stillVesting="0.00" totalGFI="0.00" totalUSD="0.00" walletBalance="0.00" />

      <div className="gfi-rewards table-spaced">
        <div className="table-header background-container-inner">
          <h2 className="table-cell col32 title">GFI Rewards</h2>
          {!isTabletOrMobile && (
            <>
              <div className="table-cell col20 numeric balance">Granted GFI</div>
              <div className="table-cell col20 numeric limit">Claimable GFI</div>
            </>
          )}
        </div>
        <ul className="rewards-list">
          {gfiRewards.length === 0 && <NoRewards />}

          {gfiRewards.length > 0 &&
            gfiRewards.map((item) => (
              <RewardsListItem
                key={item.title}
                isCommunityRewards={item.isCommunityRewards}
                title={item.title}
                grantedGFI={item.grantedGFI}
                claimableGFI={item.claimableGFI}
              />
            ))}
        </ul>
      </div>
    </div>
  )
}

export default Rewards
