import {assertUnreachable, genExhaustiveTuple} from "@goldfinch-eng/utils/src/type"
import BigNumber from "bignumber.js"
import _ from "lodash"
import moment from "moment"
import {EventData} from "web3-eth-contract"
import {assertNumber} from "../utils"
import web3 from "../web3"
import {usdcFromAtomic} from "./erc20"
import {fiduFromAtomic} from "./fidu"
import {gfiFromAtomic} from "./gfi"
import {RichAmount, AmountWithUnits, HistoricalTx, TxName} from "./transactions"

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
export const REWARD_PAID_EVENT = "RewardPaid"
export const GRANT_ACCEPTED_EVENT = "GrantAccepted"
export const SHARE_PRICE_UPDATED_EVENT = "SharePriceUpdated"
export const INVESTMENT_MADE_IN_SENIOR_EVENT = "InvestmentMadeInSenior"
export const INVESTMENT_MADE_IN_JUNIOR_EVENT = "InvestmentMadeInJunior"
export const PRINCIPAL_WRITTEN_DOWN_EVENT = "PrincipalWrittenDown"
export const BORROWER_CREATED_EVENT = "BorrowerCreated"
export const POOL_CREATED_EVENT = "PoolCreated"

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
  | typeof REWARD_PAID_EVENT
  | typeof GRANT_ACCEPTED_EVENT
  | typeof SHARE_PRICE_UPDATED_EVENT
  | typeof INVESTMENT_MADE_IN_SENIOR_EVENT
  | typeof INVESTMENT_MADE_IN_JUNIOR_EVENT
  | typeof PRINCIPAL_WRITTEN_DOWN_EVENT
  | typeof BORROWER_CREATED_EVENT
  | typeof POOL_CREATED_EVENT

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
    val === REWARD_PAID_EVENT ||
    val === GRANT_ACCEPTED_EVENT ||
    val === SHARE_PRICE_UPDATED_EVENT ||
    val === INVESTMENT_MADE_IN_SENIOR_EVENT ||
    val === INVESTMENT_MADE_IN_JUNIOR_EVENT ||
    val === PRINCIPAL_WRITTEN_DOWN_EVENT ||
    val === BORROWER_CREATED_EVENT ||
    val === POOL_CREATED_EVENT
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

export type StakingRewardsEventType =
  | typeof STAKED_EVENT
  | typeof DEPOSITED_AND_STAKED_EVENT
  | typeof UNSTAKED_EVENT
  | typeof UNSTAKED_AND_WITHDREW_EVENT
  | typeof UNSTAKED_AND_WITHDREW_MULTIPLE_EVENT
  | typeof REWARD_PAID_EVENT
export const STAKING_REWARDS_EVENT_TYPES = genExhaustiveTuple<StakingRewardsEventType>()(
  STAKED_EVENT,
  DEPOSITED_AND_STAKED_EVENT,
  UNSTAKED_EVENT,
  UNSTAKED_AND_WITHDREW_EVENT,
  UNSTAKED_AND_WITHDREW_MULTIPLE_EVENT,
  REWARD_PAID_EVENT
)

// NOTE: We don't worry about including "Granted" events here, because "Granted" from the CommunityRewards
// contract is redundant with "GrantAccepted" from the MerkleDistributor contract, except in the case
// where a grant was issued directly on the CommunityRewards contract by the admin -- which is a case
// we don't need to worry about specially surfacing in the UI.
export type CommunityRewardsEventType = typeof REWARD_PAID_EVENT
export const COMMUNITY_REWARDS_EVENT_TYPES = genExhaustiveTuple<CommunityRewardsEventType>()(REWARD_PAID_EVENT)

export type MerkleDistributorEventType = typeof GRANT_ACCEPTED_EVENT
export const MERKLE_DISTRIBUTOR_EVENT_TYPES = genExhaustiveTuple<MerkleDistributorEventType>()(GRANT_ACCEPTED_EVENT)

async function mapEventsToTx<T extends KnownEventName>(
  events: EventData[],
  known: T[],
  config: EventParserConfig<T>
): Promise<HistoricalTx<T>[]> {
  const txs = await Promise.all(_.compact(events).map((event: EventData) => mapEventToTx<T>(event, known, config)))
  return _.reverse(_.sortBy(_.compact(txs), "blockNumber"))
}

export type KnownEventData<T extends KnownEventName> = EventData & {event: T}
export function isKnownEventData<T extends KnownEventName>(obj: EventData, types: T[]): obj is KnownEventData<T> {
  return (types as string[]).includes(obj.event)
}

type EventParserConfig<T extends KnownEventName> = {
  parseName: (eventData: KnownEventData<T>) => TxName
  parseAmount: (eventData: KnownEventData<T>) => AmountWithUnits
}

function getRichAmount(amount: AmountWithUnits): RichAmount {
  if (!amount.amount) {
    console.error("Empty string amount parses as NaN BigNumber.")
  }
  const atomic = new BigNumber(amount.amount)
  let display: string
  switch (amount.units) {
    case "usdc":
      display = usdcFromAtomic(atomic)
      break
    case "fidu":
      display = fiduFromAtomic(atomic)
      break
    case "gfi":
      display = gfiFromAtomic(atomic)
      break
    default:
      assertUnreachable(amount.units)
  }
  return {atomic, display, units: amount.units}
}

async function mapEventToTx<T extends KnownEventName>(
  eventData: EventData,
  known: T[],
  config: EventParserConfig<T>
): Promise<HistoricalTx<T> | undefined> {
  if (isKnownEventData<T>(eventData, known)) {
    return web3.eth.getBlock(eventData.blockNumber).then((block) => {
      const parsedName = config.parseName(eventData)
      const parsedAmount = config.parseAmount(eventData)

      assertNumber(block.timestamp)
      return {
        current: false,
        type: eventData.event,
        name: parsedName,
        amount: getRichAmount(parsedAmount),
        id: eventData.transactionHash,
        blockNumber: eventData.blockNumber,
        blockTime: block.timestamp,
        date: moment.unix(block.timestamp).format("MMM D, h:mma"),
        status: "successful",
        eventId: (eventData as any).id,
        erc20: (eventData as any).erc20,
      }
    })
  } else {
    console.error(`Unexpected event type: ${eventData.event}. Expected: ${known}`)
    return
  }
}

function getBalanceAsOf<T extends KnownEventName, U extends T>(
  events: KnownEventData<T>[],
  blockNumExclusive: number,
  subtractiveEventName: U,
  getEventAmount: (eventData: KnownEventData<T>) => BigNumber
): BigNumber {
  const filtered = events.filter((eventData: KnownEventData<T>) => eventData.blockNumber < blockNumExclusive)
  if (!filtered.length) {
    return new BigNumber(0)
  }
  return BigNumber.sum.apply(
    null,
    filtered.map((eventData) => {
      const amount = getEventAmount(eventData)
      if (eventData.event === subtractiveEventName) {
        return amount.multipliedBy(new BigNumber(-1))
      } else {
        return amount
      }
    })
  )
}

function getPoolEventAmount(eventData: KnownEventData<PoolEventType>): BigNumber {
  switch (eventData.event) {
    case DEPOSIT_MADE_EVENT:
      return new BigNumber(eventData.returnValues.amount)
    case WITHDRAWAL_MADE_EVENT:
      return new BigNumber(eventData.returnValues.userAmount)

    default:
      assertUnreachable(eventData.event)
  }
}

function reduceToKnown<T extends KnownEventName>(events: EventData[], knownEventNames: T[]) {
  const reduced = events.reduce<{
    known: KnownEventData<T>[]
    unknown: EventData[]
  }>(
    (acc, curr) => {
      if (isKnownEventData(curr, knownEventNames)) {
        acc.known.push(curr)
      } else {
        acc.unknown.push(curr)
      }
      return acc
    },
    {
      known: [],
      unknown: [],
    }
  )
  if (reduced.unknown.length) {
    console.error(
      `Unexpected event types: ${reduced.unknown.map(
        (eventData: EventData) => eventData.event
      )}. Expected: ${knownEventNames}`
    )
  }
  return reduced.known
}

export {mapEventsToTx, getBalanceAsOf, getPoolEventAmount, reduceToKnown}
