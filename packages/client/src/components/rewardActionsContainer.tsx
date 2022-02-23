import {MerkleDirectDistributorGrantInfo} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDirectDistributor/types"
import {MerkleDistributorGrantInfo} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDistributor/types"
import {assertUnreachable} from "@goldfinch-eng/utils/src/type"
import BigNumber from "bignumber.js"
import React, {useState} from "react"
import {useMediaQuery} from "react-responsive"
import {AppContext} from "../App"
import {CommunityRewardsGrant, CommunityRewardsLoaded} from "../ethereum/communityRewards"
import {gfiFromAtomic, gfiInDollars, GFILoaded, gfiToDollarsAtomic} from "../ethereum/gfi"
import {MerkleDirectDistributor, MerkleDirectDistributorLoaded} from "../ethereum/merkleDirectDistributor"
import {MerkleDistributor, MerkleDistributorLoaded} from "../ethereum/merkleDistributor"
import {StakingRewardsLoaded, StakingRewardsPosition} from "../ethereum/pool"
import {useCurrentRoute} from "../hooks/useCurrentRoute"
import {UserLoaded} from "../ethereum/user"
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
import {assertNonNullable, displayDollars, displayNumber, displayPercent, getInjectedProvider} from "../utils"
import EtherscanLink from "./etherscanLink"
import {iconCarrotDown, iconCarrotUp, iconOutArrow} from "./icons"
import LoadingButton from "./loadingButton"
import {getIsRefreshing} from "./refreshIndicator"
import {WIDTH_TYPES} from "./styleConstants"
import TransactionForm from "./transactionForm"
import useNonNullContext from "../hooks/useNonNullContext"
import {BackerMerkleDirectDistributorLoaded} from "../ethereum/backerMerkleDirectDistributor"
import {BackerMerkleDistributorLoaded} from "../ethereum/backerMerkleDistributor"
import {BackerRewardsLoaded, BackerRewardsPosition} from "../ethereum/backerRewards"

const IMMEDIATE_VESTING_SCHEDULE = "Immediate"
const ONE_WEEK_SECONDS = new BigNumber(60 * 60 * 24 * 7)
const TOKEN_LAUNCH_TIME_IN_SECONDS = 1641920400 // Tuesday, January 11, 2022 09:00:00 AM GMT-08:00
const GFI_TOKEN_IMAGE_URL = `${
  process.env.NODE_ENV === "development"
    ? process.env.REACT_APP_MURMURATION === "yes"
      ? "https://murmuration.goldfinch.finance"
      : "http://localhost:3000"
    : "https://app.goldfinch.finance"
}/gfi-token.svg`

enum RewardStatus {
  Acceptable,
  Claimable,
  TemporarilyAllClaimed,
  PermanentlyAllClaimed,
}

enum ActionButtonTexts {
  accept = "Accept",
  accepting = "Accepting...",
  claiming = "Claiming...",
  claimGFI = "Claim GFI",
  claimed = "Claimed",
  vesting = "Still Locked",
}

interface ActionButtonProps {
  text: ActionButtonTexts
  disabled: boolean
  onClick: () => Promise<void>
}

function ActionButton(props: ActionButtonProps) {
  const currentRoute = useCurrentRoute()
  const {currentBlock, leavesCurrentBlock, leavesCurrentBlockTriggeringLastSuccessfulGraphRefresh} =
    useNonNullContext(AppContext)
  assertNonNullable(currentRoute)
  const [isPending, setIsPending] = useState<boolean>(false)
  const isTabletOrMobile = useMediaQuery({query: `(max-width: ${WIDTH_TYPES.screenL})`})
  const isRefreshing = getIsRefreshing(
    currentBlock,
    leavesCurrentBlock?.[currentRoute],
    leavesCurrentBlockTriggeringLastSuccessfulGraphRefresh?.[currentRoute]
  )
  const disabledClass = props.disabled || isPending || isRefreshing ? "disabled-button" : ""

  async function action(evt: any): Promise<void> {
    if (evt.target === evt.currentTarget) {
      evt.stopPropagation()
    }
    setIsPending(true)
    try {
      await props.onClick()
    } catch (err: unknown) {
      console.error(err)
      setIsPending(false)
      throw err
    }
  }

  const isAccepting = props.text === ActionButtonTexts.accept && isPending
  const isClaiming = props.text === ActionButtonTexts.claimGFI && isPending

  function getActionButtonText(): string {
    if (isAccepting) {
      return ActionButtonTexts.accepting
    }
    if (isClaiming) {
      return ActionButtonTexts.claiming
    }
    return props.text
  }

  return (
    <button
      data-testid="action-button"
      disabled={props.disabled}
      className={`${!isTabletOrMobile && "table-cell"} action ${disabledClass}`}
      onClick={action}
    >
      {getActionButtonText()}
    </button>
  )
}

interface OpenDetailsProps {
  open: boolean
}

function OpenDetails(props: OpenDetailsProps) {
  if (props.open) {
    return <button className="open-details close">{iconCarrotUp}</button>
  }

  return <button className="open-details">{iconCarrotDown}</button>
}

type BaseItemDetails = {
  transactionDetails: string
  shortTransactionDetails: string
  vestingSchedule: string
  vestingStatus: string
  claimStatus: string
  etherscanAddress: string | undefined
}
type FullItemDetails<T> = BaseItemDetails & {
  type: T
  currentEarnRate: string
}
type LimitedItemDetails<T> = BaseItemDetails & {
  type: T
  currentEarnRate: undefined
}
type StakingRewardsDetails = FullItemDetails<StakingRewardsRewardType>
type BackerRewardsDetails = LimitedItemDetails<BackerRewardsRewardType>
type CommunityRewardsDetails = LimitedItemDetails<CommunityRewardsRewardType>
type MerkleDistributorGrantDetails = LimitedItemDetails<MerkleDistributorRewardType>
type MerkleDirectDistributorGrantDetails = LimitedItemDetails<MerkleDirectDistributorRewardType>

type ItemDetails =
  | MerkleDistributorGrantDetails
  | MerkleDirectDistributorGrantDetails
  | CommunityRewardsDetails
  | StakingRewardsDetails
  | BackerRewardsDetails

type ClaimableItemWithDetails =
  | {
      item: StakingRewardsPosition
      details: StakingRewardsDetails
    }
  | {
      item: BackerRewardsPosition
      details: BackerRewardsDetails
    }
  | {
      item: CommunityRewardsGrant
      details: CommunityRewardsDetails
    }

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
            <DetailLabel>Unlock schedule</DetailLabel>
            <DetailValue>{vestingSchedule}</DetailValue>
          </Detail>
          <Detail>
            <DetailLabel data-testid="claim-status-label">Claim status</DetailLabel>
            <DetailValue data-testid="claim-status-value">{claimStatus}</DetailValue>
          </Detail>
        </Column>
        <Column>
          <Detail>
            <DetailLabel>Current earn rate</DetailLabel>
            <DetailValue>{currentEarnRate}</DetailValue>
          </Detail>
          <Detail>
            <DetailLabel>Unlock status</DetailLabel>
            <DetailValue>{vestingStatus}</DetailValue>
          </Detail>
        </Column>
      </ColumnsContainer>
    )
  } else {
    const {transactionDetails, vestingSchedule, vestingStatus, claimStatus} = props.itemDetails
    columns = (
      <ColumnsContainer>
        <Column>
          <Detail>
            <DetailLabel>Transaction details</DetailLabel>
            <DetailValue>{transactionDetails}</DetailValue>
          </Detail>
          <Detail>
            <DetailLabel>Unlock status</DetailLabel>
            <DetailValue>{vestingStatus}</DetailValue>
          </Detail>
        </Column>
        <Column>
          <Detail>
            <DetailLabel>Unlock schedule</DetailLabel>
            <DetailValue>{vestingSchedule}</DetailValue>
          </Detail>
          <Detail>
            <DetailLabel data-testid="claim-status-label">Claim status</DetailLabel>
            <DetailValue data-testid="claim-status-value">{claimStatus}</DetailValue>
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
          <EtherscanLink txHash={props.itemDetails.etherscanAddress}>
            Etherscan<span className="outbound-link">{iconOutArrow}</span>
          </EtherscanLink>
        </EtherscanLinkContainer>
      )}
    </DetailsContainer>
  )
}

interface ClaimFormProps {
  totalUSD: BigNumber | undefined
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
          {displayDollars(props.totalUSD)}) that has unlocked.
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
  subtitle: string
  unvestedGFI: BigNumber
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

  const actionButtonComponent = <ActionButton {...getActionButtonProps(props)} />

  const detailsComponent = <Details open={open} disabled={disabledText} itemDetails={props.details} />

  const unvestedGFIZeroDisabled = displayNumber(gfiFromAtomic(props.unvestedGFI), 2) === "0.00" ? "disabled-text" : ""
  const claimableGFIZeroDisabled = displayNumber(gfiFromAtomic(props.claimableGFI), 2) === "0.00" ? "disabled-text" : ""

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
                  <span className="detail-label">Locked GFI</span>
                  <div className={`${unvestedGFIZeroDisabled}`} data-testid="detail-unvested">
                    {displayNumber(gfiFromAtomic(props.unvestedGFI), 2)}
                  </div>
                </div>
                <div className="detail-container">
                  <span className="detail-label">Claimable GFI</span>
                  <div className={`${claimableGFIZeroDisabled}`} data-testid="detail-claimable">
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
              <div className="table-cell col32">
                {props.title}
                <div className="subtitle">{props.subtitle}</div>
              </div>
              <div className={`table-cell col20 numeric ${unvestedGFIZeroDisabled}`} data-testid="detail-unvested">
                {displayNumber(gfiFromAtomic(props.unvestedGFI), 2)}
              </div>
              <div className={`table-cell col20 numeric ${claimableGFIZeroDisabled}`} data-testid="detail-claimable">
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
    return IMMEDIATE_VESTING_SCHEDULE
  }
}
function getDirectGrantVestingSchedule(): string {
  return IMMEDIATE_VESTING_SCHEDULE
}
function getStakingRewardsVestingSchedule(endTime: number) {
  const vestingEndDate = new Date(endTime * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
  return `Linear until 100% on ${vestingEndDate}`
}
function getClaimStatus(claimed: BigNumber, vested: BigNumber, gfiPrice: BigNumber | undefined): string {
  return `${displayDollars(gfiInDollars(gfiToDollarsAtomic(claimed, gfiPrice)))} (${displayNumber(
    gfiFromAtomic(claimed)
  )} GFI) claimed of your total unlocked ${displayNumber(gfiFromAtomic(vested), 2)} GFI`
}
function getVestingStatus(vested: BigNumber, granted: BigNumber): string {
  return `${displayPercent(vested.dividedBy(granted))} (${displayNumber(gfiFromAtomic(vested), 2)} GFI) unlocked`
}
function getCurrentEarnRate(currentEarnRate: BigNumber): string {
  return `+${displayNumber(gfiFromAtomic(currentEarnRate.multipliedBy(ONE_WEEK_SECONDS)), 2)} GFI granted per week`
}
function getAirdropShortTransactionDetails(startTime, granted) {
  const transactionDate = new Date(startTime * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
  return `${displayNumber(gfiFromAtomic(granted))} GFI • ${transactionDate}`
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
    shortTransactionDetails: getAirdropShortTransactionDetails(TOKEN_LAUNCH_TIME_IN_SECONDS, item.granted),
    transactionDetails: `${displayNumber(gfiFromAtomic(item.granted))} GFI for participating ${displayReason}`,
    vestingSchedule: getGrantVestingSchedule(
      new BigNumber(item.grantInfo.grant.cliffLength),
      new BigNumber(item.grantInfo.grant.vestingInterval),
      vestingLength ? {absolute: false, value: vestingLength} : null
    ),
    claimStatus: "Unclaimed",
    currentEarnRate: undefined,
    vestingStatus: `${displayDollars(
      gfiInDollars(gfiToDollarsAtomic(item.vested, gfi.info.value.price))
    )} (${displayNumber(gfiFromAtomic(item.vested))} GFI) unlocked`,
    etherscanAddress: undefined,
  }
}
function getMerkleDirectDistributorGrantDetails(
  item: MerkleDirectDistributorGrant,
  gfi: GFILoaded
): MerkleDirectDistributorGrantDetails {
  const displayReason = MerkleDirectDistributor.getDisplayReason(item.grantInfo.reason)
  return {
    type: "merkleDirectDistributor",
    shortTransactionDetails: getAirdropShortTransactionDetails(TOKEN_LAUNCH_TIME_IN_SECONDS, item.granted),
    transactionDetails: `${displayNumber(gfiFromAtomic(item.granted))} GFI for participating ${displayReason}`,
    vestingSchedule: getDirectGrantVestingSchedule(),
    claimStatus: item.accepted ? "Claimed" : "Unclaimed",
    currentEarnRate: undefined,
    vestingStatus: `${displayDollars(
      gfiInDollars(gfiToDollarsAtomic(item.vested, gfi.info.value.price))
    )} (${displayNumber(gfiFromAtomic(item.vested))} GFI) unlocked`,
    etherscanAddress: item.acceptEvent?.transactionHash,
  }
}

type CommunityRewardsRewardType = "communityRewards"
type StakingRewardsRewardType = "stakingRewards"
type BackerRewardsRewardType = "backerRewards"
type MerkleDistributorRewardType = "merkleDistributor"
type MerkleDirectDistributorRewardType = "merkleDirectDistributor"

type RewardActionsContainerProps = {
  disabled: boolean
  user: UserLoaded
  gfi: GFILoaded
  merkleDistributor: MerkleDistributorLoaded | BackerMerkleDistributorLoaded
  merkleDirectDistributor: MerkleDirectDistributorLoaded | BackerMerkleDirectDistributorLoaded
  stakingRewards: StakingRewardsLoaded
  communityRewards: CommunityRewardsLoaded
  backerRewards: BackerRewardsLoaded
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
      type: BackerRewardsRewardType
      item: BackerRewardsPosition
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

  async function requestUserAddGfiTokenToWallet(previousGfiBalance: BigNumber): Promise<void> {
    if (previousGfiBalance.eq(0)) {
      return getInjectedProvider()
        .request({
          method: "wallet_watchAsset",
          params: {
            type: "ERC20",
            options: {
              address: props.gfi.address,
              symbol: "GFI",
              decimals: 18,
              image: GFI_TOKEN_IMAGE_URL,
            },
          },
        })
        .then((success: boolean) => {
          if (!success) {
            throw new Error("Failed to add GFI token to wallet.")
          }
        })
        .catch(console.error)
    } else {
      // Don't ask the user to add the GFI asset to their wallet, as for Metamask this was
      // observed to prompt the user with another dialog even if GFI was already an asset in
      // their wallet -- in which case Metamask includes this warning in the dialog:
      // "This action will edit tokens that are already listed in your wallet, which can
      // be used to phish you. Only approve if you are certain that you mean to change
      // what these tokens represent." Seems better to optimize for not triggering this UX,
      // which will possibly concern the user (even though it need not; a better-designed
      // Metamask would detect that the GFI contract address in the request is equal to the
      // address of the asset already in the wallet, and not show such a warning, or not
      // show the dialog at all...), than to be aggressive about getting the user to add
      // the asset to their wallet.
    }
  }

  async function handleClaimSingle(rewards: StakingRewardsLoaded | CommunityRewardsLoaded, tokenId: string) {
    assertNonNullable(rewards)
    const previousGfiBalance = props.user.info.value.gfiBalance
    await sendFromUser(
      rewards.contract.userWallet.methods.getReward(tokenId),
      {
        type: CLAIM_TX_TYPE,
        data: {},
      },
      {rejectOnError: true}
    )
    await requestUserAddGfiTokenToWallet(previousGfiBalance)
  }

  async function handleClaimMultiple(rewards: BackerRewardsLoaded, tokenIds: string[]) {
    assertNonNullable(rewards)
    const previousGfiBalance = props.user.info.value.gfiBalance
    await sendFromUser(
      rewards.contract.userWallet.methods.withdrawMultiple(tokenIds),
      {
        type: CLAIM_TX_TYPE,
        data: {},
      },
      {rejectOnError: true}
    )
    await requestUserAddGfiTokenToWallet(previousGfiBalance)
  }

  function handleAcceptMerkleDistributorGrant(info: MerkleDistributorGrantInfo): Promise<void> {
    assertNonNullable(props.merkleDistributor)
    return sendFromUser(
      props.merkleDistributor.contract.userWallet.methods.acceptGrant(
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
      },
      {rejectOnError: true}
    )
    // NOTE: We do not call `requestUserAddGfiTokenToWallet()` here because accepting a MerkleDistributor
    // grant does not transfer GFI to the user. For MerkleDistributor grants, it's most relevant to ask the user to
    // add GFI to their wallet only as part of `handleClaim()`.
  }
  async function handleAcceptMerkleDirectDistributorGrant(info: MerkleDirectDistributorGrantInfo): Promise<void> {
    assertNonNullable(props.merkleDirectDistributor)
    const previousGfiBalance = props.user.info.value.gfiBalance
    await sendFromUser(
      props.merkleDirectDistributor.contract.userWallet.methods.acceptGrant(info.index, info.grant.amount, info.proof),
      {
        type: ACCEPT_TX_TYPE,
        data: {
          index: info.index,
        },
      },
      {rejectOnError: true}
    )
    // For MerkleDirectDistributor grants (unlike MerkleDistributor grants), accepting the grant does transfer GFI
    // to them, so it is relevant to ask the user here to add GFI to their wallet.
    await requestUserAddGfiTokenToWallet(previousGfiBalance)
  }

  function renderRewardsItemWithForm<T extends ClaimableItemWithDetails>(
    itemWithDetails: T,
    getAllClaimedStatus: (item: T["item"]) => RewardStatus.TemporarilyAllClaimed | RewardStatus.PermanentlyAllClaimed,
    handleClaim: () => Promise<void>
  ) {
    const {item, details} = itemWithDetails
    if (item.claimable.eq(0)) {
      const status = getAllClaimedStatus(item)
      return (
        <RewardsListItem
          status={status}
          title={item.title}
          subtitle={details.shortTransactionDetails}
          unvestedGFI={item.unvested}
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
          title={item.title}
          subtitle={details.shortTransactionDetails}
          unvestedGFI={item.unvested}
          claimableGFI={item.claimable}
          handleOnClick={async () => setShowAction(true)}
          details={details}
          disabled={props.disabled}
        />
      )
    }

    return (
      <ClaimForm
        action={async (): Promise<void> => {
          await handleClaim()
          onCloseForm()
        }}
        disabled={item.claimable.eq(0)}
        claimable={item.claimable}
        totalUSD={gfiInDollars(gfiToDollarsAtomic(item.claimable, props.gfi.info.value.price))}
        onCloseForm={onCloseForm}
      />
    )
  }

  if (props.type === "stakingRewards") {
    const item = props.item
    const details: StakingRewardsDetails = {
      type: "stakingRewards",
      shortTransactionDetails: item.shortDescription,
      transactionDetails: item.description,
      vestingSchedule: getStakingRewardsVestingSchedule(item.storedPosition.rewards.endTime),
      claimStatus: getClaimStatus(item.claimed, item.vested, props.gfi.info.value.price),
      currentEarnRate: getCurrentEarnRate(item.currentEarnRate),
      vestingStatus: getVestingStatus(item.vested, item.granted),
      etherscanAddress: item.stakedEvent.transactionHash,
    }
    return renderRewardsItemWithForm(
      {item, details},
      (item: StakingRewardsPosition) =>
        item.storedPosition.amount.eq(0) ? RewardStatus.PermanentlyAllClaimed : RewardStatus.TemporarilyAllClaimed,
      () => handleClaimSingle(props.stakingRewards, item.tokenId)
    )
  } else if (props.type === "backerRewards") {
    const item = props.item
    const details: BackerRewardsDetails = {
      type: "backerRewards",
      shortTransactionDetails: item.shortDescription,
      transactionDetails: item.description,
      vestingSchedule: IMMEDIATE_VESTING_SCHEDULE,
      claimStatus: getClaimStatus(item.claimed, item.vested, props.gfi.info.value.price),
      currentEarnRate: undefined,
      vestingStatus: getVestingStatus(item.vested, item.granted),
      etherscanAddress: undefined,
    }
    return renderRewardsItemWithForm(
      {item, details},
      (item: BackerRewardsPosition) =>
        item.backer.tranchedPool.isRepaid ? RewardStatus.PermanentlyAllClaimed : RewardStatus.TemporarilyAllClaimed,
      () =>
        handleClaimMultiple(
          props.backerRewards,
          item.tokenPositions.map((tokenPosition) => tokenPosition.tokenId)
        )
    )
  } else if (props.type === "communityRewards") {
    const item = props.item
    const details: CommunityRewardsDetails = {
      type: "communityRewards",
      shortTransactionDetails: item.shortDescription,
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
      claimStatus: getClaimStatus(item.claimed, item.vested, props.gfi.info.value.price),
      currentEarnRate: undefined,
      vestingStatus: getVestingStatus(item.vested, item.granted),
      etherscanAddress: item.acceptanceContext?.event.transactionHash,
    }
    return renderRewardsItemWithForm(
      {item, details},
      (item: CommunityRewardsGrant) =>
        item.claimed.lt(item.granted)
          ? item.revoked
            ? RewardStatus.PermanentlyAllClaimed
            : RewardStatus.TemporarilyAllClaimed
          : RewardStatus.PermanentlyAllClaimed,
      () => handleClaimSingle(props.communityRewards, item.tokenId)
    )
  } else if (props.type === "merkleDistributor") {
    const item = props.item
    const details = getNotAcceptedMerkleDistributorGrantDetails(item, props.gfi, props.merkleDistributor)
    return (
      <RewardsListItem
        status={RewardStatus.Acceptable}
        title={MerkleDistributor.getDisplayTitle(item.grantInfo.reason)}
        subtitle={details.shortTransactionDetails}
        unvestedGFI={item.unvested}
        claimableGFI={item.claimable}
        handleOnClick={() => handleAcceptMerkleDistributorGrant(item.grantInfo)}
        details={details}
        disabled={props.disabled}
      />
    )
  } else if (props.type === "merkleDirectDistributor") {
    const item = props.item
    const details = getMerkleDirectDistributorGrantDetails(item, props.gfi)
    return (
      <RewardsListItem
        status={item.accepted ? RewardStatus.PermanentlyAllClaimed : RewardStatus.Claimable}
        title={MerkleDirectDistributor.getDisplayTitle(item.grantInfo.reason)}
        subtitle={details.shortTransactionDetails}
        unvestedGFI={item.unvested}
        claimableGFI={item.claimable}
        handleOnClick={() => handleAcceptMerkleDirectDistributorGrant(item.grantInfo)}
        details={details}
        disabled={props.disabled}
      />
    )
  } else {
    return assertUnreachable(props)
  }
}

export default RewardActionsContainer
