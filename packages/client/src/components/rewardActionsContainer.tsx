import React, {useState} from "react"
import {useMediaQuery} from "react-responsive"
import _ from "lodash"
import BigNumber from "bignumber.js"
import {MerkleDistributorGrantInfo} from "@goldfinch-eng/protocol/blockchain_scripts/merkleDistributor/types"
import {gfiFromAtomic} from "../ethereum/gfi"
import {WIDTH_TYPES} from "./styleConstants"
import {MerkleDistributor, CommunityRewardsVesting, CommunityRewards} from "../ethereum/communityRewards"
import {StakingRewards, StakedPosition} from "../ethereum/pool"
import useSendFromUser from "../hooks/useSendFromUser"
import {displayNumber, displayDollars, assertNonNullable} from "../utils"
import {iconCarrotDown} from "./icons"
import LoadingButton from "./loadingButton"
import TransactionForm from "./transactionForm"

interface ActionButtonProps {
  text: string
  disabled: boolean
  onClick: () => Promise<void>
}

function ActionButton(props: ActionButtonProps) {
  const [isPending, setIsPending] = useState<boolean>(false)
  const isTabletOrMobile = useMediaQuery({query: `(max-width: ${WIDTH_TYPES.screenL})`})
  const disabledClass = props.disabled || isPending ? "disabled-button" : ""

  async function action(): Promise<void> {
    setIsPending(true)
    await props.onClick()
    setIsPending(false)
  }

  return (
    <button className={`${!isTabletOrMobile && "table-cell"} action ${disabledClass}`} onClick={action}>
      {props.text}
    </button>
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
          Claim the total available {displayNumber(gfiFromAtomic(props.claimable), 2)} GFI ($
          {displayDollars(props.totalUSD)}) that has vested.
        </div>
        <LoadingButton text="Submit" action={props.action} disabled={props.disabled} />
      </div>
    )
  }

  return <TransactionForm headerMessage="Claim" render={renderForm} closeForm={props.onCloseForm} />
}

enum RewardStatus {
  Acceptable,
  Claimable,
  Claimed,
}

interface RewardsListItemProps {
  title: string
  grantedGFI: BigNumber
  claimableGFI: BigNumber
  status: RewardStatus
  handleOnClick: () => Promise<void>
}

function RewardsListItem(props: RewardsListItemProps) {
  const isTabletOrMobile = useMediaQuery({query: `(max-width: ${WIDTH_TYPES.screenL})`})
  const valueDisabledClass = props.status === RewardStatus.Acceptable ? "disabled-text" : ""

  const actionButtonComponent =
    props.status === RewardStatus.Acceptable ? (
      <ActionButton text="Accept" onClick={props.handleOnClick} disabled={false} />
    ) : props.status === RewardStatus.Claimable && props.claimableGFI.eq(0) ? (
      <ActionButton text="Vesting" onClick={props.handleOnClick} disabled={true} />
    ) : props.status === RewardStatus.Claimable && props.claimableGFI.gt(0) ? (
      <ActionButton text="Claim GFI" onClick={props.handleOnClick} disabled={false} />
    ) : (
      <ActionButton text="Claimed" onClick={props.handleOnClick} disabled={true} />
    )

  return (
    <>
      {!isTabletOrMobile && (
        <li className="rewards-list-item table-row background-container clickable">
          <div className="table-cell col32">{props.title}</div>
          <div className={`table-cell col20 numeric ${valueDisabledClass}`}>
            {displayNumber(gfiFromAtomic(props.grantedGFI), 2)}
          </div>
          <div className={`table-cell col20 numeric ${valueDisabledClass}`}>
            {displayNumber(gfiFromAtomic(props.claimableGFI), 2)}
          </div>
          {actionButtonComponent}
          <button className="expand">{iconCarrotDown}</button>
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
              <div className={`${valueDisabledClass}`}>{displayNumber(gfiFromAtomic(props.grantedGFI), 2)}</div>
            </div>
            <div className="detail-container">
              <span className="detail-label">Claimable GFI</span>
              <div className={`${valueDisabledClass}`}>{displayNumber(gfiFromAtomic(props.claimableGFI), 2)}</div>
            </div>
          </div>
          {actionButtonComponent}
        </li>
      )}
    </>
  )
}

function capitalizeMerkleDistributorGrantReason(reason: string): string {
  return reason
    .split("_")
    .map((s) => _.startCase(s))
    .join(" ")
}

interface RewardActionsContainerProps {
  merkleDistributor: MerkleDistributor
  stakingRewards: StakingRewards
  item: CommunityRewardsVesting | StakedPosition | MerkleDistributorGrantInfo
}

function RewardActionsContainer(props: RewardActionsContainerProps) {
  const sendFromUser = useSendFromUser()
  const [showAction, setShowAction] = useState<boolean>(false)
  const {item} = props

  function onCloseForm() {
    setShowAction(false)
  }

  function handleClaim(rewards: CommunityRewards | StakingRewards, tokenId: string) {
    assertNonNullable(rewards)
    return sendFromUser(rewards.contract.methods.getReward(tokenId), {
      type: "Claim",
    })
  }

  function handleAccept(info): Promise<void> {
    assertNonNullable(props.merkleDistributor)
    return sendFromUser(
      props.merkleDistributor.contract.methods.acceptGrant(
        info.index,
        info.account,
        info.grant.amount,
        info.grant.vestingLength,
        info.grant.cliffLength,
        info.grant.vestingInterval,
        info.proof
      ),
      {
        type: "Accept",
        amount: gfiFromAtomic(info.grant.amount),
      }
    )
  }

  if (item instanceof CommunityRewardsVesting || item instanceof StakedPosition) {
    const title = item instanceof StakedPosition ? item.reason : capitalizeMerkleDistributorGrantReason(item.reason)

    if (item.rewards.totalClaimed.isEqualTo(item.granted) && !item.granted.eq(0)) {
      return (
        <RewardsListItem
          status={RewardStatus.Claimed}
          title={title}
          grantedGFI={item.granted}
          claimableGFI={item.claimable}
          handleOnClick={() => Promise.resolve()}
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
        />
      )
    }

    const reward = item instanceof StakedPosition ? props.stakingRewards : props.merkleDistributor.communityRewards
    return (
      <ClaimForm
        action={async (): Promise<void> => {
          await handleClaim(reward, item.tokenId)
          onCloseForm()
        }}
        disabled={item.claimable.eq(0)}
        claimable={item.claimable}
        totalUSD={new BigNumber("")} // TODO: this needs to be updated once we have a price for GFI in USD.
        onCloseForm={onCloseForm}
      />
    )
  } else {
    const title = capitalizeMerkleDistributorGrantReason(item.reason)
    return (
      <RewardsListItem
        status={RewardStatus.Acceptable}
        title={title}
        grantedGFI={new BigNumber(item.grant.amount)}
        claimableGFI={new BigNumber(0)}
        handleOnClick={() => handleAccept(item)}
      />
    )
  }
}

export default RewardActionsContainer
