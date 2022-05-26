import {genExhaustiveTuple} from "@goldfinch-eng/utils/src/type"
import {EventData} from "web3-eth-contract"

export const DEPOSIT_MADE_EVENT = "DepositMade"
export const STAKED_EVENT = "Staked"
export const DEPOSITED_AND_STAKED_EVENT = "DepositedAndStaked"
export const UNSTAKED_EVENT = "Unstaked"
export const WITHDRAWAL_MADE_EVENT = "WithdrawalMade"
export const DRAWDOWN_MADE_EVENT = "DrawdownMade"
export const PAYMENT_COLLECTED_EVENT = "PaymentCollected"
export const PAYMENT_APPLIED_EVENT = "PaymentApplied"
export const APPROVAL_EVENT = "Approval"
export const INTEREST_COLLECTED_EVENT = "InterestCollected"
export const PRINCIPAL_COLLECTED_EVENT = "PrincipalCollected"
export const RESERVE_FUNDS_COLLECTED_EVENT = "ReserveFundsCollected"
export const UNSTAKED_AND_WITHDREW_EVENT = "UnstakedAndWithdrew"
export const UNSTAKED_AND_WITHDREW_MULTIPLE_EVENT = "UnstakedAndWithdrewMultiple"
export const UNSTAKED_MULTIPLE_EVENT = "UnstakedMultiple"
export const REWARD_PAID_EVENT = "RewardPaid"
export const GRANT_ACCEPTED_EVENT = "GrantAccepted"
export const SHARE_PRICE_UPDATED_EVENT = "SharePriceUpdated"
export const INVESTMENT_MADE_IN_SENIOR_EVENT = "InvestmentMadeInSenior"
export const INVESTMENT_MADE_IN_JUNIOR_EVENT = "InvestmentMadeInJunior"
export const PRINCIPAL_WRITTEN_DOWN_EVENT = "PrincipalWrittenDown"
export const BORROWER_CREATED_EVENT = "BorrowerCreated"
export const POOL_CREATED_EVENT = "PoolCreated"
export const DEPOSITED_TO_CURVE_EVENT = "DepositedToCurve"
export const DEPOSITED_TO_CURVE_AND_STAKED_EVENT = "DepositedToCurveAndStaked"

export type KnownEventName =
  | typeof DEPOSIT_MADE_EVENT
  | typeof STAKED_EVENT
  | typeof DEPOSITED_AND_STAKED_EVENT
  | typeof UNSTAKED_EVENT
  | typeof WITHDRAWAL_MADE_EVENT
  | typeof DRAWDOWN_MADE_EVENT
  | typeof PAYMENT_COLLECTED_EVENT
  | typeof PAYMENT_APPLIED_EVENT
  | typeof APPROVAL_EVENT
  | typeof INTEREST_COLLECTED_EVENT
  | typeof PRINCIPAL_COLLECTED_EVENT
  | typeof RESERVE_FUNDS_COLLECTED_EVENT
  | typeof UNSTAKED_AND_WITHDREW_EVENT
  | typeof UNSTAKED_AND_WITHDREW_MULTIPLE_EVENT
  | typeof UNSTAKED_MULTIPLE_EVENT
  | typeof REWARD_PAID_EVENT
  | typeof GRANT_ACCEPTED_EVENT
  | typeof SHARE_PRICE_UPDATED_EVENT
  | typeof INVESTMENT_MADE_IN_SENIOR_EVENT
  | typeof INVESTMENT_MADE_IN_JUNIOR_EVENT
  | typeof PRINCIPAL_WRITTEN_DOWN_EVENT
  | typeof BORROWER_CREATED_EVENT
  | typeof POOL_CREATED_EVENT
  | typeof DEPOSITED_TO_CURVE_EVENT
  | typeof DEPOSITED_TO_CURVE_AND_STAKED_EVENT

export function isKnownEventName(val: unknown): val is KnownEventName {
  return (
    val === DEPOSIT_MADE_EVENT ||
    val === STAKED_EVENT ||
    val === DEPOSITED_AND_STAKED_EVENT ||
    val === UNSTAKED_EVENT ||
    val === WITHDRAWAL_MADE_EVENT ||
    val === DRAWDOWN_MADE_EVENT ||
    val === PAYMENT_COLLECTED_EVENT ||
    val === PAYMENT_APPLIED_EVENT ||
    val === APPROVAL_EVENT ||
    val === INTEREST_COLLECTED_EVENT ||
    val === PRINCIPAL_COLLECTED_EVENT ||
    val === RESERVE_FUNDS_COLLECTED_EVENT ||
    val === UNSTAKED_AND_WITHDREW_EVENT ||
    val === UNSTAKED_AND_WITHDREW_MULTIPLE_EVENT ||
    val === UNSTAKED_MULTIPLE_EVENT ||
    val === REWARD_PAID_EVENT ||
    val === GRANT_ACCEPTED_EVENT ||
    val === SHARE_PRICE_UPDATED_EVENT ||
    val === INVESTMENT_MADE_IN_SENIOR_EVENT ||
    val === INVESTMENT_MADE_IN_JUNIOR_EVENT ||
    val === PRINCIPAL_WRITTEN_DOWN_EVENT ||
    val === BORROWER_CREATED_EVENT ||
    val === POOL_CREATED_EVENT ||
    val === DEPOSITED_TO_CURVE_EVENT ||
    val === DEPOSITED_TO_CURVE_AND_STAKED_EVENT
  )
}

export type PoolEventType = typeof DEPOSIT_MADE_EVENT | typeof WITHDRAWAL_MADE_EVENT
export const POOL_EVENT_TYPES = genExhaustiveTuple<PoolEventType>()(DEPOSIT_MADE_EVENT, WITHDRAWAL_MADE_EVENT)

export type CreditDeskEventType = typeof PAYMENT_COLLECTED_EVENT | typeof DRAWDOWN_MADE_EVENT
export const CREDIT_DESK_EVENT_TYPES = genExhaustiveTuple<CreditDeskEventType>()(
  PAYMENT_COLLECTED_EVENT,
  DRAWDOWN_MADE_EVENT
)

export type TranchedPoolEventType =
  | typeof DEPOSIT_MADE_EVENT
  | typeof WITHDRAWAL_MADE_EVENT
  | typeof PAYMENT_APPLIED_EVENT
  | typeof DRAWDOWN_MADE_EVENT
export const TRANCHED_POOL_EVENT_TYPES = genExhaustiveTuple<TranchedPoolEventType>()(
  DEPOSIT_MADE_EVENT,
  WITHDRAWAL_MADE_EVENT,
  PAYMENT_APPLIED_EVENT,
  DRAWDOWN_MADE_EVENT
)

export type ApprovalEventType = typeof APPROVAL_EVENT
export const APPROVAL_EVENT_TYPES = genExhaustiveTuple<ApprovalEventType>()(APPROVAL_EVENT)

export type LegacyStakingRewardsEventType =
  | typeof STAKED_EVENT
  | typeof DEPOSITED_AND_STAKED_EVENT
  | typeof UNSTAKED_EVENT
  | typeof UNSTAKED_AND_WITHDREW_EVENT
  | typeof UNSTAKED_AND_WITHDREW_MULTIPLE_EVENT
  | typeof REWARD_PAID_EVENT

export function isLegacyStakingRewardsEventType(val: unknown): boolean {
  return (
    val === STAKED_EVENT ||
    val === DEPOSITED_AND_STAKED_EVENT ||
    val === UNSTAKED_EVENT ||
    val === UNSTAKED_AND_WITHDREW_EVENT ||
    val === UNSTAKED_AND_WITHDREW_MULTIPLE_EVENT ||
    val === REWARD_PAID_EVENT
  )
}

export type StakingRewardsEventType =
  | LegacyStakingRewardsEventType
  | typeof UNSTAKED_MULTIPLE_EVENT
  | typeof DEPOSITED_TO_CURVE_EVENT
  | typeof DEPOSITED_TO_CURVE_AND_STAKED_EVENT
// Legacy events that existed in StakingRewards before the v2.6.0 migration.
export const STAKING_REWARDS_LEGACY_EVENT_TYPES = genExhaustiveTuple<LegacyStakingRewardsEventType>()(
  STAKED_EVENT,
  DEPOSITED_AND_STAKED_EVENT,
  UNSTAKED_EVENT,
  UNSTAKED_AND_WITHDREW_EVENT,
  UNSTAKED_AND_WITHDREW_MULTIPLE_EVENT,
  REWARD_PAID_EVENT
)
// All events that in the current version of StakingRewards.
export const STAKING_REWARDS_EVENT_TYPES = genExhaustiveTuple<StakingRewardsEventType>()(
  ...STAKING_REWARDS_LEGACY_EVENT_TYPES,
  UNSTAKED_MULTIPLE_EVENT,
  DEPOSITED_TO_CURVE_EVENT,
  DEPOSITED_TO_CURVE_AND_STAKED_EVENT
)

// NOTE: We don't worry about including "Granted" events here, because "Granted" from the CommunityRewards
// contract is redundant with "GrantAccepted" from the MerkleDistributor contract, except in the case
// where a grant was issued directly on the CommunityRewards contract by the admin -- which is a case
// we don't need to worry about specially surfacing in the UI.
export type CommunityRewardsEventType = typeof REWARD_PAID_EVENT
export const COMMUNITY_REWARDS_EVENT_TYPES = genExhaustiveTuple<CommunityRewardsEventType>()(REWARD_PAID_EVENT)

export type MerkleDistributorEventType = typeof GRANT_ACCEPTED_EVENT
export const MERKLE_DISTRIBUTOR_EVENT_TYPES = genExhaustiveTuple<MerkleDistributorEventType>()(GRANT_ACCEPTED_EVENT)

export type MerkleDirectDistributorEventType = typeof GRANT_ACCEPTED_EVENT
export const MERKLE_DIRECT_DISTRIBUTOR_EVENT_TYPES =
  genExhaustiveTuple<MerkleDirectDistributorEventType>()(GRANT_ACCEPTED_EVENT)

export type BackerMerkleDistributorEventType = MerkleDistributorEventType
export const BACKER_MERKLE_DISTRIBUTOR_EVENT_TYPES = MERKLE_DISTRIBUTOR_EVENT_TYPES

export type BackerMerkleDirectDistributorEventType = MerkleDirectDistributorEventType
export const BACKER_MERKLE_DIRECT_DISTRIBUTOR_EVENT_TYPES = MERKLE_DIRECT_DISTRIBUTOR_EVENT_TYPES

export type KnownEventData<T extends KnownEventName> = EventData & {event: T}
export function isKnownEventData<T extends KnownEventName>(obj: EventData, types: T[]): obj is KnownEventData<T> {
  return (types as string[]).includes(obj.event)
}
