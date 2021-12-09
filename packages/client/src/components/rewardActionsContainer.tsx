import {MerkleDirectDistributorGrantInfo} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDirectDistributor/types"
import {MerkleDistributorGrantInfo} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDistributor/types"
import {assertUnreachable} from "@goldfinch-eng/utils/src/type"
import BigNumber from "bignumber.js"
import React, {useState} from "react"
import {useMediaQuery} from "react-responsive"
import {
  CommunityRewardsGrant,
  CommunityRewardsLoaded,
  MerkleDirectDistributor,
  MerkleDirectDistributorLoaded,
} from "../ethereum/communityRewards"
import {gfiFromAtomic, gfiInDollars, GFILoaded, gfiToDollarsAtomic} from "../ethereum/gfi"
import {MerkleDistributor, MerkleDistributorLoaded} from "../ethereum/merkleDistributor"
import {StakingRewardsLoaded, StakingRewardsPosition} from "../ethereum/pool"
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
import {MerkleDirectDistributorGrant} from "../types/merkleDirectDistributor"
import {NotAcceptedMerkleDistributorGrant} from "../types/merkleDistributor"
import {ACCEPT_TX_TYPE, CLAIM_TX_TYPE} from "../types/transactions"
import {assertNonNullable, displayDollars, displayNumber, displayPercent} from "../utils"
import EtherscanLink from "./etherscanLink"
import {iconCarrotDown, iconCarrotUp, iconOutArrow} from "./icons"
import LoadingButton from "./loadingButton"
import {WIDTH_TYPES} from "./styleConstants"
import TransactionForm from "./transactionForm"

const ONE_WEEK_SECONDS = new BigNumber(60 * 60 * 24 * 7)
export const TOKEN_LAUNCH_TIME_IN_SECONDS = 1641924000 // Tuesday, January 11, 2022 10:00:00 AM GMT-08:00

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
    <button
      disabled={props.disabled}
      className={`${!isTabletOrMobile && "table-cell"} action ${disabledClass}`}
      onClick={action}
    >
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

type BaseItemDetails = {
  transactionDetails: string
  vestingSchedule: string
  vestingStatus: string
  etherscanAddress: string
}
type FullItemDetails<T> = BaseItemDetails & {
  type: T
  claimStatus: string
  currentEarnRate: string
}
type LimitedItemDetails<T> = BaseItemDetails & {
  type: T
  claimStatus: undefined
  currentEarnRate: undefined
}
type StakingRewardsDetails = FullItemDetails<StakingRewardsRewardType>
type CommunityRewardsDetails = LimitedItemDetails<CommunityRewardsRewardType>
type MerkleDistributorGrantDetails = LimitedItemDetails<MerkleDistributorRewardType>
type MerkleDirectDistributorGrantDetails = LimitedItemDetails<MerkleDirectDistributorRewardType>
type ItemDetails =
  | MerkleDistributorGrantDetails
  | MerkleDirectDistributorGrantDetails
  | CommunityRewardsDetails
  | StakingRewardsDetails

type DetailsProps = {
  open: boolean
  disabled: boolean
  itemDetails: ItemDetails
}

function Details(props: DetailsProps) {
  let columns: React.ReactElement<typeof ColumnsContainer>
  if (props.itemDetails.type === "stakingRewards") {
    const {transactionDetails, vestingSchedule, claimStatus, currentEarnRate, vestingStatus} = props.itemDetails
    columns = (
      <ColumnsContainer>
        <Column>
          <Detail>
            <DetailLabel>Transaction details</DetailLabel>
            <DetailValue>{transactionDetails}</DetailValue>
          </Detail>
          <Detail>
            <DetailLabel>Vesting schedule</DetailLabel>
            <DetailValue>{vestingSchedule}</DetailValue>
          </Detail>
          <Detail>
            <DetailLabel>Claim status</DetailLabel>
            <DetailValue>{claimStatus}</DetailValue>
          </Detail>
        </Column>
        <Column>
          <Detail>
            <DetailLabel>Current earn rate</DetailLabel>
            <DetailValue>{currentEarnRate}</DetailValue>
          </Detail>
          <Detail>
            <DetailLabel>Vesting status</DetailLabel>
            <DetailValue>{vestingStatus}</DetailValue>
          </Detail>
        </Column>
      </ColumnsContainer>
    )
  } else {
    const {transactionDetails, vestingSchedule, vestingStatus} = props.itemDetails
    columns = (
      <ColumnsContainer>
        <Column>
          <Detail>
            <DetailLabel>Transaction details</DetailLabel>
            <DetailValue>{transactionDetails}</DetailValue>
          </Detail>
          <Detail>
            <DetailLabel>Vesting status</DetailLabel>
            <DetailValue>{vestingStatus}</DetailValue>
          </Detail>
        </Column>
        <Column>
          <Detail>
            <DetailLabel>Vesting schedule</DetailLabel>
            <DetailValue>{vestingSchedule}</DetailValue>
          </Detail>
        </Column>
      </ColumnsContainer>
    )
  }
  return (
    <DetailsContainer open={props.open} disabled={props.disabled}>
      {columns}
      {props.itemDetails.etherscanAddress && (
        <EtherscanLinkContainer className="pool-links">
          <EtherscanLink address={props.itemDetails.etherscanAddress}>
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
        disabled: props.disabled,
      }
    case RewardStatus.Claimable:
      return {
        ...baseProps,
        text: ActionButtonTexts.claimGFI,
        disabled: props.disabled,
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
  disabled: boolean
  handleOnClick: () => Promise<void>
}

function RewardsListItem(props: RewardsListItemProps) {
  const [open, setOpen] = useState<boolean>(false)
  const isTabletOrMobile = useMediaQuery({query: `(max-width: ${WIDTH_TYPES.screenL})`})

  const disabledText = props.status === RewardStatus.Acceptable
  const valueDisabledClass = disabledText ? "disabled-text" : ""

  const actionButtonComponent = <ActionButton {...getActionButtonProps(props)} />

  const detailsComponent = <Details open={open} disabled={disabledText} itemDetails={props.details} />

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
                  <span className="detail-label">
                    {
                      // NOTE: Consistently with our approach in the rewards summary and rewards list item
                      // column labels, we describe the value to the user here as what's vested, though the
                      // value we use is what's claimable. What's claimable is the relevant piece of information
                      // that informs their understanding of whether they should be able to take any action
                      // with the list item button.
                      "Vested GFI"
                    }
                  </span>
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
  switch (cliffLengthString) {
    case "0":
      return undefined
    case "15768000":
      return ", with six-month cliff"
    default:
      console.warn(`Unexpected cliff length: ${cliffLengthString}`)
      const cliffLengthInDays = Math.ceil(parseInt(cliffLengthString, 10) / (3600 * 24))
      return ` with ${cliffLengthInDays}-day cliff`
  }
}
function getGrantVestingLengthDisplay(end: {absolute: boolean; value: number}): string {
  const endDate = new Date(
    (end.absolute ? end.value : TOKEN_LAUNCH_TIME_IN_SECONDS + end.value) * 1000
  ).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
  return ` on ${endDate}`
}
function getGrantVestingSchedule(
  cliffLength: BigNumber,
  vestingInterval: BigNumber,
  end: {absolute: boolean; value: number} | null
): string {
  if (end) {
    const displayCliff = getGrantVestingCliffDisplay(cliffLength)
    const displayInterval = getGrantVestingIntervalDisplay(vestingInterval)
    const displayEnd = getGrantVestingLengthDisplay(end)
    return `Linear${displayInterval || ""}${displayCliff || ""}${
      displayInterval || displayCliff ? "," : ""
    } until 100%${displayEnd}`
  } else {
    return "Immediate"
  }
}
function getDirectGrantVestingSchedule(): string {
  return "Immediate"
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

function getNotAcceptedMerkleDistributorGrantDetails(
  item: NotAcceptedMerkleDistributorGrant,
  gfi: GFILoaded,
  merkleDistributor: MerkleDistributorLoaded
): MerkleDistributorGrantDetails {
  const displayReason = MerkleDistributor.getDisplayReason(item.grantInfo.reason)
  const vestingLength = new BigNumber(item.grantInfo.grant.vestingLength).toNumber()
  return {
    type: "merkleDistributor",
    transactionDetails: `${displayNumber(gfiFromAtomic(item.granted))} GFI reward for participating ${displayReason}`,
    vestingSchedule: getGrantVestingSchedule(
      new BigNumber(item.grantInfo.grant.cliffLength),
      new BigNumber(item.grantInfo.grant.vestingInterval),
      vestingLength ? {absolute: false, value: vestingLength} : null
    ),
    claimStatus: undefined,
    currentEarnRate: undefined,
    vestingStatus: `${displayDollars(
      gfiInDollars(gfiToDollarsAtomic(item.vested, gfi.info.value.price))
    )} (${displayNumber(gfiFromAtomic(item.vested))} GFI) vested`,
    etherscanAddress: merkleDistributor.address,
  }
}
function getMerkleDirectDistributorGrantDetails(
  item: MerkleDirectDistributorGrant,
  gfi: GFILoaded,
  merkleDirectDistributor: MerkleDirectDistributorLoaded
): MerkleDirectDistributorGrantDetails {
  const displayReason = MerkleDirectDistributor.getDisplayReason(item.grantInfo.reason)
  return {
    type: "merkleDirectDistributor",
    transactionDetails: `${displayNumber(gfiFromAtomic(item.granted))} GFI reward for participating ${displayReason}`,
    vestingSchedule: getDirectGrantVestingSchedule(),
    claimStatus: undefined,
    currentEarnRate: undefined,
    vestingStatus: `${displayDollars(
      gfiInDollars(gfiToDollarsAtomic(item.vested, gfi.info.value.price))
    )} (${displayNumber(gfiFromAtomic(item.vested))} GFI) vested`,
    etherscanAddress: merkleDirectDistributor.address,
  }
}
function getStakingOrCommunityRewardsDetails(
  item: StakingRewardsPosition | CommunityRewardsGrant,
  stakingRewards: StakingRewardsLoaded,
  communityRewards: CommunityRewardsLoaded
): StakingRewardsDetails | CommunityRewardsDetails {
  if (item instanceof StakingRewardsPosition) {
    return {
      type: "stakingRewards",
      transactionDetails: item.description,
      vestingSchedule: getStakingRewardsVestingSchedule(item.storedPosition.rewards.endTime),
      claimStatus: getClaimStatus(item.claimed, item.vested),
      currentEarnRate: getCurrentEarnRate(item.currentEarnRate),
      vestingStatus: getVestingStatus(item.vested, item.granted),
      etherscanAddress: stakingRewards.address,
    }
  } else {
    return {
      type: "communityRewards",
      transactionDetails: item.description,
      vestingSchedule: getGrantVestingSchedule(
        item.rewards.cliffLength,
        item.rewards.vestingInterval,
        item.rewards.endTime > item.rewards.startTime
          ? {
              absolute: true,
              value: item.rewards.endTime,
            }
          : null
      ),
      claimStatus: undefined,
      currentEarnRate: undefined,
      vestingStatus: getVestingStatus(item.vested, item.granted),
      etherscanAddress: communityRewards.address,
    }
  }
}

type CommunityRewardsRewardType = "communityRewards"
type StakingRewardsRewardType = "stakingRewards"
type MerkleDistributorRewardType = "merkleDistributor"
type MerkleDirectDistributorRewardType = "merkleDirectDistributor"

type RewardActionsContainerProps = {
  disabled: boolean
  gfi: GFILoaded
  merkleDistributor: MerkleDistributorLoaded
  merkleDirectDistributor: MerkleDirectDistributorLoaded
  stakingRewards: StakingRewardsLoaded
  communityRewards: CommunityRewardsLoaded
} & (
  | {
      type: CommunityRewardsRewardType
      item: CommunityRewardsGrant
    }
  | {
      type: StakingRewardsRewardType
      item: StakingRewardsPosition
    }
  | {
      type: MerkleDistributorRewardType
      item: NotAcceptedMerkleDistributorGrant
    }
  | {
      type: MerkleDirectDistributorRewardType
      item: MerkleDirectDistributorGrant
    }
)

function RewardActionsContainer(props: RewardActionsContainerProps) {
  const sendFromUser = useSendFromUser()
  const [showAction, setShowAction] = useState<boolean>(false)

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

  function handleAcceptMerkleDistributorGrant(info: MerkleDistributorGrantInfo): Promise<void> {
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
  function handleAcceptMerkleDirectDistributorGrant(info: MerkleDirectDistributorGrantInfo): Promise<void> {
    assertNonNullable(props.merkleDirectDistributor)
    return sendFromUser(
      props.merkleDirectDistributor.contract.methods.acceptGrant(info.index, info.grant.amount, info.proof),
      {
        type: ACCEPT_TX_TYPE,
        data: {
          index: info.index,
        },
      }
    )
  }

  if (props.type === "communityRewards" || props.type === "stakingRewards") {
    const item = props.item
    const title = item.title
    const details = getStakingOrCommunityRewardsDetails(item, props.stakingRewards, props.communityRewards)

    if (item.claimable.eq(0)) {
      let status: RewardStatus
      if (item instanceof CommunityRewardsGrant) {
        if (item.claimed.lt(item.granted)) {
          if (item.revoked) {
            status = RewardStatus.PermanentlyAllClaimed
          } else {
            status = RewardStatus.TemporarilyAllClaimed
          }
        } else {
          status = RewardStatus.PermanentlyAllClaimed
        }
      } else {
        if (item.storedPosition.amount.eq(0)) {
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
          disabled={props.disabled}
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
          disabled={props.disabled}
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
  } else if (props.type === "merkleDistributor") {
    const item = props.item
    const details = getNotAcceptedMerkleDistributorGrantDetails(item, props.gfi, props.merkleDistributor)
    return (
      <RewardsListItem
        status={RewardStatus.Acceptable}
        title={MerkleDistributor.getDisplayTitle(item.grantInfo.reason)}
        grantedGFI={item.granted}
        claimableGFI={item.claimable}
        handleOnClick={() => handleAcceptMerkleDistributorGrant(item.grantInfo)}
        details={details}
        disabled={props.disabled}
      />
    )
  } else if (props.type === "merkleDirectDistributor") {
    const item = props.item
    const details = getMerkleDirectDistributorGrantDetails(item, props.gfi, props.merkleDirectDistributor)
    return (
      <RewardsListItem
        status={item.accepted ? RewardStatus.PermanentlyAllClaimed : RewardStatus.Acceptable}
        title={MerkleDirectDistributor.getDisplayTitle(item.grantInfo.reason)}
        grantedGFI={item.granted}
        claimableGFI={item.claimable}
        handleOnClick={() => handleAcceptMerkleDirectDistributorGrant(item.grantInfo)}
        details={details}
        disabled={props.disabled}
      />
    )
  } else {
    assertUnreachable(props)
  }
}

export default RewardActionsContainer
