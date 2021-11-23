import {MerkleDistributorGrantInfo} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDistributor/types"
import {assertUnreachable} from "@goldfinch-eng/utils/src/type"
import BigNumber from "bignumber.js"
import React, {useContext, useState} from "react"
import {useMediaQuery} from "react-responsive"
import {
  CommunityRewardsGrant,
  CommunityRewardsLoaded,
  MerkleDistributor,
  MerkleDistributorLoaded,
} from "../ethereum/communityRewards"
import {gfiFromAtomic, gfiInDollars, GFILoaded, gfiToDollarsAtomic} from "../ethereum/gfi"
import {StakingRewardsLoaded, StakingRewardsPosition} from "../ethereum/pool"
import {ACCEPT_TX_TYPE, CLAIM_TX_TYPE} from "../types/transactions"
import useSendFromUser from "../hooks/useSendFromUser"
import {
  Column,
  ColumnsContainer,
  Detail,
  DetailLabel,
  DetailsContainer,
  DetailValue,
  EtherscanLinkContainer,
} from "../pages/rewards/styles"
import {assertNonNullable, displayDollars, displayNumber, displayPercent} from "../utils"
import EtherscanLink from "./etherscanLink"
import {iconCarrotDown, iconCarrotUp, iconOutArrow} from "./icons"
import LoadingButton from "./loadingButton"
import {WIDTH_TYPES} from "./styleConstants"
import TransactionForm from "./transactionForm"
import {AppContext} from "../App"

const ONE_WEEK_SECONDS = new BigNumber(60 * 60 * 24 * 7)
const TOKEN_LAUNCH_TIME_IN_SECONDS = 1638900000 // Tuesday, December 7, 2021 10:00:00 AM GMT-08:00

enum RewardStatus {
  Acceptable,
  Claimable,
  TemporarilyAllClaimed,
  PermanentlyAllClaimed,
}

enum ActionButtonTexts {
  accept = "Accept",
  accepting = "Accepting...",
  claimGFI = "Claim GFI",
  claimed = "Claimed",
  vesting = "Vesting",
}

interface ActionButtonProps {
  text: ActionButtonTexts
  disabled: boolean
  onClick: () => Promise<void>
}

function ActionButton(props: ActionButtonProps) {
  const [isPending, setIsPending] = useState<boolean>(false)
  const isTabletOrMobile = useMediaQuery({query: `(max-width: ${WIDTH_TYPES.screenL})`})
  const disabledClass = props.disabled || isPending ? "disabled-button" : ""

  async function action(e): Promise<void> {
    if (e.target === e.currentTarget) {
      e.stopPropagation()
    }
    setIsPending(true)
    await props.onClick()
    setIsPending(false)
  }

  const isAccepting = props.text === ActionButtonTexts.accept && isPending

  return (
    <button className={`${!isTabletOrMobile && "table-cell"} action ${disabledClass}`} onClick={action}>
      {isAccepting ? ActionButtonTexts.accepting : props.text}
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

type ItemDetails = {
  transactionDetails: string
  vestingSchedule: string
  claimStatus: string | undefined
  currentEarnRate: string | undefined
  vestingStatus: string
  etherscanAddress: string
}

type DetailsProps = ItemDetails & {
  open: boolean
  disabled: boolean
}

function Details(props: DetailsProps) {
  let columns
  if (props.claimStatus && props.currentEarnRate) {
    columns = (
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
    )
  } else {
    columns = (
      <ColumnsContainer>
        <Column>
          <Detail>
            <DetailLabel>Transaction details</DetailLabel>
            <DetailValue>{props.transactionDetails}</DetailValue>
          </Detail>
          {props.vestingStatus && (
            <Detail>
              <DetailLabel>Vesting status</DetailLabel>
              <DetailValue>{props.vestingStatus}</DetailValue>
            </Detail>
          )}
        </Column>
        <Column>
          <Detail>
            <DetailLabel>Vesting schedule</DetailLabel>
            <DetailValue>{props.vestingSchedule}</DetailValue>
          </Detail>
        </Column>
      </ColumnsContainer>
    )
  }
  return (
    <DetailsContainer open={props.open} disabled={props.disabled}>
      {columns}
      {props.etherscanAddress && (
        <EtherscanLinkContainer className="pool-links">
          <EtherscanLink address={props.etherscanAddress}>
            Etherscan<span className="outbound-link">{iconOutArrow}</span>
          </EtherscanLink>
        </EtherscanLinkContainer>
      )}
    </DetailsContainer>
  )
}

interface ClaimFormProps {
  totalUSD: BigNumber
  claimable: BigNumber
  disabled: boolean
  onCloseForm: () => void
  action: () => Promise<void>
}

function ClaimForm(props: ClaimFormProps) {
  function renderForm({formMethods}) {
    return (
      <div className="info-banner background-container subtle">
        <div className="message">
          Claim the total available {displayNumber(gfiFromAtomic(props.claimable), 2)} GFI (
          {displayDollars(props.totalUSD)}) that has vested.
        </div>
        <LoadingButton text="Submit" action={props.action} disabled={props.disabled} />
      </div>
    )
  }

  return <TransactionForm headerMessage="Claim" render={renderForm} closeForm={props.onCloseForm} />
}

function getActionButtonProps(props: RewardsListItemProps): ActionButtonProps {
  const baseProps: Pick<ActionButtonProps, "onClick"> = {
    onClick: props.handleOnClick,
  }
  switch (props.status) {
    case RewardStatus.Acceptable:
      return {
        ...baseProps,
        text: ActionButtonTexts.accept,
        disabled: false,
      }
    case RewardStatus.Claimable:
      return {
        ...baseProps,
        text: ActionButtonTexts.claimGFI,
        disabled: false,
      }
    case RewardStatus.TemporarilyAllClaimed:
      return {
        ...baseProps,
        text: ActionButtonTexts.vesting,
        disabled: true,
      }
    case RewardStatus.PermanentlyAllClaimed:
      return {
        ...baseProps,
        text: ActionButtonTexts.claimed,
        disabled: true,
      }
    case RewardStatus.FullyUnstakedAndClaimed:
      return {
        ...baseProps,
        text: ActionButtonTexts.claimed,
        disabled: true,
      }
    default:
      return assertUnreachable(props.status)
  }
}

interface RewardsListItemProps {
  title: string
  grantedGFI: BigNumber
  claimableGFI: BigNumber
  status: RewardStatus
  details: ItemDetails
  handleOnClick: () => Promise<void>
}

function RewardsListItem(props: RewardsListItemProps) {
  const [open, setOpen] = useState<boolean>(false)
  const isTabletOrMobile = useMediaQuery({query: `(max-width: ${WIDTH_TYPES.screenL})`})

  const disabledText = props.status === RewardStatus.Acceptable
  const valueDisabledClass = disabledText ? "disabled-text" : ""

  const actionButtonComponent = <ActionButton {...getActionButtonProps(props)} />

  const detailsComponent = (
    <Details
      open={open}
      disabled={disabledText}
      transactionDetails={props.details.transactionDetails}
      vestingSchedule={props.details.vestingSchedule}
      claimStatus={props.details.claimStatus}
      currentEarnRate={props.details.currentEarnRate}
      vestingStatus={props.details.vestingStatus}
      etherscanAddress={props.details.etherscanAddress}
    />
  )

  return (
    <>
      {isTabletOrMobile ? (
        <li>
          <div onClick={() => setOpen(!open)}>
            <div className="rewards-list-item background-container clickable mobile">
              <div className="item-header">
                <div>{props.title}</div>
                <OpenDetails open={open} />
              </div>
              <div className="item-details">
                <div className="detail-container">
                  <span className="detail-label">Granted GFI</span>
                  <div className={`${valueDisabledClass}`} data-testid="detail-granted">
                    {displayNumber(gfiFromAtomic(props.grantedGFI), 2)}
                  </div>
                </div>
                <div className="detail-container">
                  <span className="detail-label">Claimable GFI</span>
                  <div className={`${valueDisabledClass}`} data-testid="detail-claimable">
                    {displayNumber(gfiFromAtomic(props.claimableGFI), 2)}
                  </div>
                </div>
              </div>
              {actionButtonComponent}
            </div>
          </div>
          {open && detailsComponent}
        </li>
      ) : (
        <li>
          <div onClick={() => setOpen(!open)}>
            <div className="rewards-list-item table-row background-container clickable">
              <div className="table-cell col32">{props.title}</div>
              <div className={`table-cell col20 numeric ${valueDisabledClass}`} data-testid="detail-granted">
                {displayNumber(gfiFromAtomic(props.grantedGFI), 2)}
              </div>
              <div className={`table-cell col20 numeric ${valueDisabledClass}`} data-testid="detail-claimable">
                {displayNumber(gfiFromAtomic(props.claimableGFI), 2)}
              </div>
              {actionButtonComponent}
              <OpenDetails open={open} />
            </div>
          </div>
          {open && detailsComponent}
        </li>
      )}
    </>
  )
}

function getGrantVestingIntervalDisplay(vestingInterval: BigNumber): string | undefined {
  // Right now we decided that it was best not to show the vesting interval.
  return undefined
}
function getGrantVestingCliffDisplay(cliffLength: BigNumber): string | undefined {
  const cliffLengthString = cliffLength.toString(10)
  const cliffLengthInDays = Math.ceil(Number(cliffLengthString) / (3600 * 24))
  switch (cliffLengthString) {
    case "0":
      return undefined
    case "15768000":
      return ", with six-month cliff"
    default:
      console.warn(`Unexpected cliff length: ${cliffLengthString}`)
      const cliffDisplayText = ` with ${cliffLengthInDays}${cliffLengthInDays === 1 ? "-day" : " days"} cliff`
      return cliffLengthInDays ? cliffDisplayText : ""
  }
}
function getGrantVestingLengthDisplay(duration: number, currentTimestamp: number | undefined): string {
  const startDate = TOKEN_LAUNCH_TIME_IN_SECONDS
  const endDate = new Date((startDate + duration) * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
  switch (duration) {
    case 0:
      throw new Error("Grant without vesting length should have avoided calling this method.")
    case 31536000:
      return " after 1 year"
    default:
      console.warn(`Unexpected vesting length: ${duration}`)
      return endDate ? ` on ${endDate}` : `after ${duration} seconds`
  }
}
function getGrantVestingSchedule(
  cliffLength: BigNumber,
  vestingInterval: BigNumber,
  end: {absolute: boolean; value: number} | null,
  currentTimestamp: number | undefined
): string {
  if (end) {
    const displayCliff = getGrantVestingCliffDisplay(cliffLength)
    const displayInterval = getGrantVestingIntervalDisplay(vestingInterval)
    const displayEnd = end.absolute
      ? ` on ${new Date(end.value * 1000).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}`
      : `${getGrantVestingLengthDisplay(end.value, currentTimestamp)}`
    return `Linear ${displayInterval || ""}${displayCliff || ""}${
      displayInterval || displayCliff ? "," : ""
    } until 100%${displayEnd}`
  } else {
    // Since we will not have a vesting length here, we don't need to make calculations to show
    // end date. Note that showing the current timestamp can be misleading.
    return "Immediate"
  }
}
function getStakingRewardsVestingSchedule(endTime: number) {
  const vestingEndDate = new Date(endTime * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
  return `Linear until 100% on ${vestingEndDate}`
}
function getClaimStatus(claimed: BigNumber, vested: BigNumber): string {
  return `${displayNumber(gfiFromAtomic(claimed))} claimed of your total vested ${displayNumber(
    gfiFromAtomic(vested),
    2
  )} GFI`
}
function getVestingStatus(vested: BigNumber, granted: BigNumber): string {
  return `${displayPercent(vested.dividedBy(granted))} (${displayNumber(gfiFromAtomic(vested), 2)} GFI) vested`
}
function getCurrentEarnRate(currentEarnRate: BigNumber): string {
  return `+${displayNumber(gfiFromAtomic(currentEarnRate.multipliedBy(ONE_WEEK_SECONDS)), 2)} granted per week`
}

function getMerkleDistributorGrantInfoDetails(
  grantInfo: MerkleDistributorGrantInfo,
  merkleDistributor: MerkleDistributorLoaded,
  currentTimestamp: number | undefined
): ItemDetails {
  const amount = new BigNumber(grantInfo.grant.amount)
  const displayReason = MerkleDistributor.getDisplayReason(grantInfo.reason)
  const vestingLength = new BigNumber(grantInfo.grant.vestingLength).toNumber()
  const zero = new BigNumber(0)
  return {
    transactionDetails: `${displayNumber(gfiFromAtomic(amount))} GFI reward for participating ${displayReason}`,
    vestingSchedule: getGrantVestingSchedule(
      new BigNumber(grantInfo.grant.cliffLength),
      new BigNumber(grantInfo.grant.vestingInterval),
      vestingLength ? {absolute: false, value: vestingLength} : null,
      currentTimestamp
    ),
    claimStatus: undefined,
    currentEarnRate: undefined,
    vestingStatus: `${displayDollars(undefined)} (${displayNumber(zero)} GFI) vested`,
    etherscanAddress: merkleDistributor.address,
  }
}
function getStakingOrCommunityRewardsDetails(
  item: StakingRewardsPosition | CommunityRewardsGrant,
  stakingRewards: StakingRewardsLoaded,
  communityRewards: CommunityRewardsLoaded,
  currentTimestamp: number | undefined
): ItemDetails {
  if (item instanceof StakingRewardsPosition) {
    return {
      transactionDetails: item.description,
      vestingSchedule: getStakingRewardsVestingSchedule(item.storedPosition.rewards.endTime),
      claimStatus: getClaimStatus(item.claimed, item.vested),
      currentEarnRate: getCurrentEarnRate(item.currentEarnRate),
      vestingStatus: getVestingStatus(item.vested, item.granted),
      etherscanAddress: stakingRewards.address,
    }
  } else {
    return {
      transactionDetails: item.description,
      vestingSchedule: getGrantVestingSchedule(
        item.rewards.cliffLength,
        item.rewards.vestingInterval,
        item.rewards.endTime > item.rewards.startTime
          ? {
              absolute: true,
              value: item.rewards.endTime,
            }
          : null,
        currentTimestamp
      ),
      claimStatus: undefined,
      currentEarnRate: undefined,
      vestingStatus: getVestingStatus(item.vested, item.granted),
      etherscanAddress: communityRewards.address,
    }
  }
}

interface RewardActionsContainerProps {
  gfi: GFILoaded
  merkleDistributor: MerkleDistributorLoaded
  stakingRewards: StakingRewardsLoaded
  communityRewards: CommunityRewardsLoaded
  item: CommunityRewardsGrant | StakingRewardsPosition | MerkleDistributorGrantInfo
}

function RewardActionsContainer(props: RewardActionsContainerProps) {
  const sendFromUser = useSendFromUser()
  const {currentBlock} = useContext(AppContext)
  const [showAction, setShowAction] = useState<boolean>(false)
  const {item} = props

  function onCloseForm() {
    setShowAction(false)
  }

  function handleClaim(rewards: CommunityRewardsLoaded | StakingRewardsLoaded, tokenId: string) {
    assertNonNullable(rewards)
    return sendFromUser(rewards.contract.methods.getReward(tokenId), {
      type: CLAIM_TX_TYPE,
      data: {},
    })
  }

  function handleAccept(info: MerkleDistributorGrantInfo): Promise<void> {
    assertNonNullable(props.merkleDistributor)
    return sendFromUser(
      props.merkleDistributor.contract.methods.acceptGrant(
        info.index,
        info.grant.amount,
        info.grant.vestingLength,
        info.grant.cliffLength,
        info.grant.vestingInterval,
        info.proof
      ),
      {
        type: ACCEPT_TX_TYPE,
        data: {
          index: info.index,
        },
      }
    )
  }

  if (item instanceof CommunityRewardsGrant || item instanceof StakingRewardsPosition) {
    const title = item.title
    const details = getStakingOrCommunityRewardsDetails(
      item,
      props.stakingRewards,
      props.communityRewards,
      currentBlock?.timestamp
    )

    if (item.claimable.eq(0)) {
      let status: RewardStatus
      if (item instanceof CommunityRewardsGrant) {
        if (item.claimed.lt(item.granted)) {
          status = RewardStatus.TemporarilyAllClaimed
        } else {
          status = RewardStatus.PermanentlyAllClaimed
        }
      } else {
        const remainingAmount = item.storedPosition.amount
        if (remainingAmount.isZero()) {
          status = RewardStatus.PermanentlyAllClaimed
        } else {
          status = RewardStatus.TemporarilyAllClaimed
        }
      }
      return (
        <RewardsListItem
          status={status}
          title={title}
          grantedGFI={item.granted}
          claimableGFI={item.claimable}
          handleOnClick={() => Promise.resolve()}
          details={details}
        />
      )
    } else if (!showAction) {
      return (
        <RewardsListItem
          status={RewardStatus.Claimable}
          title={title}
          grantedGFI={item.granted}
          claimableGFI={item.claimable}
          handleOnClick={async () => setShowAction(true)}
          details={details}
        />
      )
    }

    const reward = item instanceof StakingRewardsPosition ? props.stakingRewards : props.communityRewards
    return (
      <ClaimForm
        action={async (): Promise<void> => {
          await handleClaim(reward, item.tokenId)
          onCloseForm()
        }}
        disabled={item.claimable.eq(0)}
        claimable={item.claimable}
        totalUSD={gfiInDollars(gfiToDollarsAtomic(item.claimable, props.gfi.info.value.price))}
        onCloseForm={onCloseForm}
      />
    )
  } else {
    const details = getMerkleDistributorGrantInfoDetails(item, props.merkleDistributor, currentBlock?.timestamp)
    return (
      <RewardsListItem
        status={RewardStatus.Acceptable}
        title={MerkleDistributor.getDisplayTitle(item.reason)}
        grantedGFI={new BigNumber(item.grant.amount)}
        claimableGFI={new BigNumber(0)}
        handleOnClick={() => handleAccept(item)}
        details={details}
      />
    )
  }
}

export default RewardActionsContainer
