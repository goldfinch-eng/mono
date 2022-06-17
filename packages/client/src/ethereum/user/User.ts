import {CreditDesk} from "./@types/legacy/CreditDesk"
import {Go} from "@goldfinch-eng/protocol/typechain/web3/Go"
import {UniqueIdentity} from "@goldfinch-eng/protocol/typechain/web3/UniqueIdentity"
import {assertUnreachable} from "@goldfinch-eng/utils/src/type"
import BigNumber from "bignumber.js"
import _ from "lodash"
import {
  ApprovalEventType,
  APPROVAL_EVENT,
  APPROVAL_EVENT_TYPES,
  BackerMerkleDirectDistributorEventType,
  BackerMerkleDistributorEventType,
  CommunityRewardsEventType,
  COMMUNITY_REWARDS_EVENT_TYPES,
  CreditDeskEventType,
  CREDIT_DESK_EVENT_TYPES,
  DEPOSITED_AND_STAKED_EVENT,
  DEPOSITED_TO_CURVE_EVENT,
  DEPOSITED_TO_CURVE_AND_STAKED_EVENT,
  DEPOSIT_MADE_EVENT,
  DRAWDOWN_MADE_EVENT,
  GRANT_ACCEPTED_EVENT,
  KnownEventData,
  MerkleDirectDistributorEventType,
  MerkleDistributorEventType,
  MERKLE_DIRECT_DISTRIBUTOR_EVENT_TYPES,
  MERKLE_DISTRIBUTOR_EVENT_TYPES,
  PAYMENT_COLLECTED_EVENT,
  PoolEventType,
  POOL_EVENT_TYPES,
  REWARD_PAID_EVENT,
  STAKED_EVENT,
  StakingRewardsEventType,
  STAKING_REWARDS_EVENT_TYPES,
  UNSTAKED_AND_WITHDREW_EVENT,
  UNSTAKED_AND_WITHDREW_MULTIPLE_EVENT,
  UNSTAKED_EVENT,
  WITHDRAWAL_MADE_EVENT,
  UNSTAKED_MULTIPLE_EVENT,
} from "../../types/events"
import {assertWithLoadedInfo, Loadable, WithLoadedInfo} from "../../types/loadable"
import {
  ACCEPT_TX_TYPE,
  AmountUnits,
  BORROW_TX_TYPE,
  CLAIM_TX_TYPE,
  DEPOSIT_TO_CURVE_AND_STAKE_TX_TYPE,
  DEPOSIT_TO_CURVE_TX_TYPE,
  FIDU_APPROVAL_TX_TYPE,
  HistoricalTx,
  PAYMENT_TX_TYPE,
  STAKE_TX_TYPE,
  SUPPLY_AND_STAKE_TX_TYPE,
  SUPPLY_TX_TYPE,
  UNSTAKE_AND_WITHDRAW_FROM_SENIOR_POOL_TX_TYPE,
  UNSTAKE_TX_TYPE,
  UNSTAKE_TX_NAME,
  USDC_APPROVAL_TX_TYPE,
  WITHDRAW_FROM_SENIOR_POOL_TX_TYPE,
} from "../../types/transactions"
import {BlockInfo, WithCurrentBlock} from "../../utils"
import {BackerMerkleDirectDistributorLoaded} from "../backerMerkleDirectDistributor"
import {BackerMerkleDistributorLoaded} from "../backerMerkleDistributor"
import {BorrowerInterface} from "../borrower"
import {CommunityRewardsLoaded} from "../communityRewards"
import {ERC20, Ticker, USDC, usdcFromAtomic} from "../erc20"
import {getBalanceAsOf, getPoolEventAmount, mapEventsToTx, populateDates} from "../events"
import {GFILoaded} from "../gfi"
import {getCachedPastEvents, GoldfinchProtocol} from "../GoldfinchProtocol"
import {MerkleDirectDistributorLoaded} from "../merkleDirectDistributor"
import {MerkleDistributorLoaded} from "../merkleDistributor"
import {getStakedPositionTypeByValue, SeniorPoolLoaded, StakedPositionType, StakingRewardsLoaded} from "../pool"
import {getFromBlock} from "../utils"
import {UserStakingRewards, UserStakingRewardsLoaded} from "./UserStakingRewards"
import {Web3IO} from "../../types/web3"

export const UNLOCK_THRESHOLD = new BigNumber(10000)

export const NON_US_INDIVIDUAL_ID_TYPE_0 = "0"
export const US_ACCREDITED_INDIVIDUAL_ID_TYPE_1 = "1"
export const US_NON_ACCREDITED_INDIVIDUAL_ID_TYPE_2 = "2"
export const US_ENTITY_ID_TYPE_3 = "3"
export const NON_US_ENTITY_ID_TYPE_4 = "4"

export type UIDType =
  | typeof NON_US_INDIVIDUAL_ID_TYPE_0
  | typeof US_ACCREDITED_INDIVIDUAL_ID_TYPE_1
  | typeof US_NON_ACCREDITED_INDIVIDUAL_ID_TYPE_2
  | typeof US_ENTITY_ID_TYPE_3
  | typeof NON_US_ENTITY_ID_TYPE_4
export type UIDTypeToBalance = Record<UIDType, boolean>

export type UserLoadedInfo = {
  currentBlock: BlockInfo
  usdcBalance: BigNumber
  usdcBalanceInDollars: BigNumber
  poolAllowance: BigNumber
  poolEvents: KnownEventData<PoolEventType>[]
  pastTxs: HistoricalTx<
    | ApprovalEventType
    | CreditDeskEventType
    | PoolEventType
    | StakingRewardsEventType
    | CommunityRewardsEventType
    | MerkleDistributorEventType
    | MerkleDirectDistributorEventType
  >[]
  poolTxs: HistoricalTx<PoolEventType>[]
  goListed: boolean
  uidTypeToBalance: UIDTypeToBalance
  gfiBalance: BigNumber
  usdcIsUnlocked: {
    earn: {
      unlockAddress: string
      isUnlocked: boolean
    }
    borrow: {
      unlockAddress: string
      isUnlocked: boolean
    }
  }
  stakingRewards: UserStakingRewardsLoaded
}

export type UserLoaded = WithLoadedInfo<User, UserLoadedInfo>

export class User {
  address: string
  networkId: string
  borrower: BorrowerInterface | undefined
  info: Loadable<UserLoadedInfo>

  goldfinchProtocol: GoldfinchProtocol

  private creditDesk: Web3IO<CreditDesk>

  constructor(
    address: string,
    networkId: string,
    creditDesk: Web3IO<CreditDesk>,
    goldfinchProtocol: GoldfinchProtocol,
    borrower: BorrowerInterface | undefined
  ) {
    if (!address) {
      throw new Error("User must have an address.")
    }
    this.address = address
    this.networkId = networkId
    this.borrower = borrower
    this.goldfinchProtocol = goldfinchProtocol
    this.creditDesk = creditDesk
    this.info = {
      loaded: false,
      value: undefined,
    }
  }

  async initialize(
    pool: SeniorPoolLoaded,
    stakingRewards: StakingRewardsLoaded,
    gfi: GFILoaded,
    communityRewards: CommunityRewardsLoaded,
    merkleDistributor: MerkleDistributorLoaded,
    merkleDirectDistributor: MerkleDirectDistributorLoaded,
    backerMerkleDistributor: BackerMerkleDistributorLoaded,
    backerMerkleDirectDistributor: BackerMerkleDirectDistributorLoaded,
    currentBlock: BlockInfo
  ) {
    const usdc = this.goldfinchProtocol.getERC20(Ticker.USDC)

    const usdcBalance = await usdc.getBalance(this.address, currentBlock)
    const usdcBalanceInDollars = new BigNumber(usdcFromAtomic(usdcBalance))
    const poolAllowance = await usdc.getAllowance({owner: this.address, spender: pool.address}, currentBlock)

    const [
      usdcTxs,
      fiduTxs,
      poolEventsAndTxs,
      creditDeskTxs,
      stakingRewardsEventsAndTxs,
      communityRewardsTxs,
      merkleDistributorTxs,
      merkleDirectDistributorTxs,
      backerMerkleDistributorTxs,
      backerMerkleDirectDistributorTxs,
    ] = await this._fetchTxs(
      usdc,
      pool,
      stakingRewards,
      communityRewards,
      merkleDistributor,
      merkleDirectDistributor,
      backerMerkleDistributor,
      backerMerkleDirectDistributor,
      currentBlock
    )
    const {poolEvents, poolTxs} = poolEventsAndTxs
    const {stakingRewardsTxs} = stakingRewardsEventsAndTxs
    let pastTxs = _.reverse(
      _.sortBy(
        [
          ...usdcTxs,
          ...fiduTxs,
          ...poolTxs,
          ...creditDeskTxs,
          ...stakingRewardsTxs,
          ...communityRewardsTxs,
          ...merkleDistributorTxs,
          ...merkleDirectDistributorTxs,
          ...backerMerkleDistributorTxs,
          ...backerMerkleDirectDistributorTxs,
        ],
        ["blockNumber", "transactionIndex"]
      )
    )
    pastTxs = await populateDates(pastTxs)

    const {goListed, uidTypeToBalance} = await this._fetchGoListStatus(this.address, currentBlock)

    const gfiBalance = new BigNumber(
      await gfi.contract.readOnly.methods.balanceOf(this.address).call(undefined, currentBlock.number)
    )

    const userStakingRewards = new UserStakingRewards()
    await userStakingRewards.initialize(this.address, stakingRewards, currentBlock)
    assertWithLoadedInfo(userStakingRewards)

    this.info = {
      loaded: true,
      value: {
        currentBlock,
        usdcBalance,
        usdcBalanceInDollars,
        poolAllowance,
        poolEvents,
        pastTxs,
        poolTxs,
        goListed,
        uidTypeToBalance,
        gfiBalance,
        usdcIsUnlocked: {
          earn: {
            unlockAddress: pool.address,
            isUnlocked: this.isUnlocked(poolAllowance),
          },
          borrow: {
            unlockAddress: this.borrower?.borrowerAddress || this.address,
            isUnlocked: this.borrower?.allowance ? this.isUnlocked(this.borrower.allowance) : false,
          },
        },
        stakingRewards: userStakingRewards,
      },
    }
  }

  async _fetchTxs(
    usdc: ERC20,
    pool: SeniorPoolLoaded,
    stakingRewards: StakingRewardsLoaded,
    communityRewards: CommunityRewardsLoaded,
    merkleDistributor: MerkleDistributorLoaded,
    merkleDirectDistributor: MerkleDirectDistributorLoaded,
    backerMerkleDistributor: BackerMerkleDistributorLoaded,
    backerMerkleDirectDistributor: BackerMerkleDirectDistributorLoaded,
    currentBlock: BlockInfo
  ) {
    return Promise.all([
      // NOTE: We have no need to include usdc txs for `pool.v1Pool` among the txs in
      // `this.pastTxs`. So we don't get them. We only need usdc txs for `pool`.
      getAndTransformUSDCEvents(usdc, pool.address, this.address, currentBlock),
      getAndTransformFIDUEvents(this.goldfinchProtocol, this.address, currentBlock),
      getPoolEvents(pool, this.address, currentBlock).then(async (poolEvents) => {
        return {
          poolEvents,
          poolTxs: await mapEventsToTx(poolEvents, POOL_EVENT_TYPES, {
            parseName: (eventData: KnownEventData<PoolEventType>) => {
              switch (eventData.event) {
                case DEPOSIT_MADE_EVENT:
                  return SUPPLY_TX_TYPE
                case WITHDRAWAL_MADE_EVENT:
                  return WITHDRAW_FROM_SENIOR_POOL_TX_TYPE
                default:
                  return assertUnreachable(eventData.event)
              }
            },
            parseAmount: (eventData: KnownEventData<PoolEventType>) => {
              switch (eventData.event) {
                case DEPOSIT_MADE_EVENT: {
                  return {
                    amount: eventData.returnValues.amount,
                    units: "usdc",
                  }
                }
                case WITHDRAWAL_MADE_EVENT: {
                  return {
                    amount: eventData.returnValues.userAmount,
                    units: "usdc",
                  }
                }
                default:
                  return assertUnreachable(eventData.event)
              }
            },
          }),
        }
      }),

      // Credit desk events could've come from the user directly or the borrower contract, we need to filter by both
      getAndTransformCreditDeskEvents(
        this.creditDesk,
        _.compact([this.address, this.borrower?.borrowerAddress]),
        this.goldfinchProtocol.networkId,
        currentBlock
      ),

      getOverlappingStakingRewardsEventsForUser(this.address, stakingRewards).then(
        async (overlappingStakingRewardsEvents) => {
          const nonOverlappingEvents = getNonOverlappingStakingRewardsEvents(overlappingStakingRewardsEvents.value)
          const stakedEvents: KnownEventData<typeof STAKED_EVENT>[] = overlappingStakingRewardsEvents.value.filter(
            (
              eventData: KnownEventData<StakingRewardsEventType>
            ): eventData is KnownEventData<StakingRewardsEventType> & {event: typeof STAKED_EVENT} =>
              eventData.event === STAKED_EVENT
          )
          return {
            stakedEvents: {
              currentBlock: overlappingStakingRewardsEvents.currentBlock,
              value: stakedEvents,
            },
            stakingRewardsTxs: await mapEventsToTx(nonOverlappingEvents, STAKING_REWARDS_EVENT_TYPES, {
              parseName: (eventData: KnownEventData<StakingRewardsEventType>) => {
                switch (eventData.event) {
                  case STAKED_EVENT:
                    return STAKE_TX_TYPE
                  case DEPOSITED_AND_STAKED_EVENT:
                    return SUPPLY_AND_STAKE_TX_TYPE
                  case DEPOSITED_TO_CURVE_EVENT:
                    return DEPOSIT_TO_CURVE_TX_TYPE
                  case DEPOSITED_TO_CURVE_AND_STAKED_EVENT:
                    return DEPOSIT_TO_CURVE_AND_STAKE_TX_TYPE
                  case UNSTAKED_EVENT:
                    return UNSTAKE_TX_NAME
                  case UNSTAKED_AND_WITHDREW_EVENT:
                  case UNSTAKED_AND_WITHDREW_MULTIPLE_EVENT:
                    return UNSTAKE_AND_WITHDRAW_FROM_SENIOR_POOL_TX_TYPE
                  case UNSTAKED_MULTIPLE_EVENT:
                    // TODO(@emilyhsia): Update with UNSTAKE_MULTIPLE_TX_TYPE when unstakeMultiple is fixed
                    return UNSTAKE_TX_TYPE
                  case REWARD_PAID_EVENT:
                    return CLAIM_TX_TYPE
                  default:
                    return assertUnreachable(eventData.event)
                }
              },
              parseAmount: async (eventData: KnownEventData<StakingRewardsEventType>) => {
                switch (eventData.event) {
                  case STAKED_EVENT:
                    return {
                      amount: eventData.returnValues.amount,
                      units: this.getUnitsForStakedPositionType(eventData.returnValues.positionType),
                    }
                  case DEPOSITED_AND_STAKED_EVENT:
                    return {
                      amount: eventData.returnValues.depositedAmount,
                      units: "usdc",
                    }
                  case DEPOSITED_TO_CURVE_EVENT:
                  case DEPOSITED_TO_CURVE_AND_STAKED_EVENT:
                    const fiduAmount = eventData.returnValues.fiduAmount
                    const usdcAmount = eventData.returnValues.usdcAmount
                    if (new BigNumber(fiduAmount).isZero() && !new BigNumber(usdcAmount).isZero()) {
                      // USDC-only deposit
                      return {
                        amount: usdcAmount,
                        units: "usdc",
                      }
                    } else if (!new BigNumber(fiduAmount).isZero() && new BigNumber(usdcAmount).isZero()) {
                      // FIDU-only deposit
                      return {
                        amount: fiduAmount,
                        units: "fidu",
                      }
                    } else {
                      throw new Error("Cannot deposit both FIDU and USDC")
                    }
                  case UNSTAKED_EVENT:
                    return {
                      amount: eventData.returnValues.amount,
                      units: this.getUnitsForStakedPositionType(eventData.returnValues.positionType),
                    }
                  case UNSTAKED_AND_WITHDREW_EVENT:
                  case UNSTAKED_AND_WITHDREW_MULTIPLE_EVENT:
                    return {
                      amount: eventData.returnValues.usdcReceivedAmount,
                      units: "usdc",
                    }
                  case UNSTAKED_MULTIPLE_EVENT:
                    // We can assume that all positions in an "Unstaked Multiple" event are of the same
                    // position type, so we just check the type of the first unstaked position.
                    const tokenId = eventData.returnValues.tokenIds[0]
                    const position = await stakingRewards.contract.readOnly.methods
                      .positions(tokenId)
                      .call(undefined, "latest")
                    return {
                      amount: eventData.returnValues.amounts.reduce(
                        (sum, amount) => new BigNumber(amount).plus(sum),
                        new BigNumber(0)
                      ),
                      units: this.getUnitsForStakedPositionType(position.positionType),
                    }
                  case REWARD_PAID_EVENT:
                    return {
                      amount: eventData.returnValues.reward,
                      units: "gfi",
                    }
                  default:
                    return assertUnreachable(eventData.event)
                }
              },
            }),
          }
        }
      ),
      getAndTransformCommunityRewardsEvents(this.address, communityRewards),
      getAndTransformMerkleDistributorEvents(this.address, merkleDistributor),
      getAndTransformMerkleDirectDistributorEvents(this.address, merkleDirectDistributor),
      getAndTransformBackerMerkleDistributorEvents(this.address, backerMerkleDistributor),
      getAndTransformBackerMerkleDirectDistributorEvents(this.address, backerMerkleDirectDistributor),
    ])
  }

  isUnlocked(allowance: BigNumber | undefined) {
    return !allowance || allowance.gte(UNLOCK_THRESHOLD)
  }

  getUnitsForStakedPositionType(stakedPositionTypeValue: string): AmountUnits {
    const positionType = getStakedPositionTypeByValue(stakedPositionTypeValue, true)
    switch (positionType) {
      case StakedPositionType.Fidu:
        return "fidu"
      case StakedPositionType.CurveLP:
        return "fidu-usdc-f"
      default:
        // Fallback to FIDU for legacy staked positions (pre GIP-01) that do not have a position type
        return "fidu"
    }
  }

  async _fetchGoListStatus(
    address: string,
    currentBlock: BlockInfo
  ): Promise<{
    goListed: boolean
    uidTypeToBalance: UIDTypeToBalance
  }> {
    const go = this.goldfinchProtocol.getContract<Go>("Go")
    const goListed = await go.readOnly.methods.go(address).call(undefined, currentBlock.number)

    // check if user has non-US or US non-accredited UID
    const uniqueIdentity = this.goldfinchProtocol.getContract<UniqueIdentity>("UniqueIdentity")
    const balances = await uniqueIdentity.readOnly.methods
      .balanceOfBatch(
        [address, address, address, address, address],
        [
          NON_US_INDIVIDUAL_ID_TYPE_0,
          US_ACCREDITED_INDIVIDUAL_ID_TYPE_1,
          US_NON_ACCREDITED_INDIVIDUAL_ID_TYPE_2,
          US_ENTITY_ID_TYPE_3,
          NON_US_ENTITY_ID_TYPE_4,
        ]
      )
      .call(undefined, currentBlock.number)

    const hasNonUSUID = !new BigNumber(String(balances[0])).isZero()
    const hasUSAccreditedUID = !new BigNumber(String(balances[1])).isZero()
    const hasUSNonAccreditedUID = !new BigNumber(String(balances[2])).isZero()
    const hasUSEntityUID = !new BigNumber(String(balances[3])).isZero()
    const hasNonUSEntityUID = !new BigNumber(String(balances[4])).isZero()

    return {
      goListed,
      uidTypeToBalance: {
        [NON_US_INDIVIDUAL_ID_TYPE_0]: hasNonUSUID,
        [US_ACCREDITED_INDIVIDUAL_ID_TYPE_1]: hasUSAccreditedUID,
        [US_NON_ACCREDITED_INDIVIDUAL_ID_TYPE_2]: hasUSNonAccreditedUID,
        [US_ENTITY_ID_TYPE_3]: hasUSEntityUID,
        [NON_US_ENTITY_ID_TYPE_4]: hasNonUSEntityUID,
      },
    }
  }

  poolBalanceAsOf(blockNumExclusive: number): BigNumber {
    assertWithLoadedInfo(this)
    return getBalanceAsOf<PoolEventType, typeof WITHDRAWAL_MADE_EVENT>(
      this.info.value.poolEvents,
      blockNumExclusive,
      WITHDRAWAL_MADE_EVENT,
      getPoolEventAmount
    )
  }
}

async function getAndTransformUSDCEvents(
  usdc: USDC,
  spender: string,
  owner: string,
  currentBlock: BlockInfo
): Promise<HistoricalTx<ApprovalEventType>[]> {
  let approvalEvents = await getCachedPastEvents(usdc.contract.readOnly, APPROVAL_EVENT, {
    filter: {owner, spender},
    fromBlock: "earliest",
    toBlock: currentBlock.number,
  })
  approvalEvents = _.chain(approvalEvents)
    .compact()
    .map((e) => _.set(e, "erc20", usdc))
    .value()
  return mapEventsToTx<ApprovalEventType>(approvalEvents, APPROVAL_EVENT_TYPES, {
    parseName: (eventData: KnownEventData<ApprovalEventType>) => {
      switch (eventData.event) {
        case APPROVAL_EVENT:
          return USDC_APPROVAL_TX_TYPE
        default:
          return assertUnreachable(eventData.event)
      }
    },
    parseAmount: (eventData: KnownEventData<ApprovalEventType>) => {
      switch (eventData.event) {
        case APPROVAL_EVENT: {
          return {
            amount: eventData.returnValues.value,
            units: "usdc",
          }
        }
        default:
          return assertUnreachable(eventData.event)
      }
    },
  })
}

async function getAndTransformFIDUEvents(
  goldfinchProtocol: GoldfinchProtocol,
  owner: string,
  currentBlock: BlockInfo
): Promise<HistoricalTx<ApprovalEventType>[]> {
  const approvalEvents = await goldfinchProtocol.queryEvents("Fidu", APPROVAL_EVENT_TYPES, {owner}, currentBlock.number)
  return mapEventsToTx<ApprovalEventType>(approvalEvents, APPROVAL_EVENT_TYPES, {
    parseName: (eventData: KnownEventData<ApprovalEventType>) => {
      switch (eventData.event) {
        case APPROVAL_EVENT:
          return FIDU_APPROVAL_TX_TYPE
        default:
          return assertUnreachable(eventData.event)
      }
    },
    parseAmount: (eventData: KnownEventData<ApprovalEventType>) => {
      switch (eventData.event) {
        case APPROVAL_EVENT: {
          return {
            amount: eventData.returnValues.value,
            units: "fidu",
          }
        }
        default:
          return assertUnreachable(eventData.event)
      }
    },
  })
}

async function getPoolEvents(
  pool: SeniorPoolLoaded,
  address: string,
  currentBlock: BlockInfo
): Promise<KnownEventData<PoolEventType>[]> {
  return await pool.getPoolEvents(address, POOL_EVENT_TYPES, true, currentBlock.number)
}

async function getAndTransformCreditDeskEvents(
  creditDesk: Web3IO<CreditDesk>,
  address: string[],
  networkId: string,
  currentBlock: BlockInfo
): Promise<HistoricalTx<CreditDeskEventType>[]> {
  const fromBlock = getFromBlock(networkId)
  const [paymentEvents, drawdownEvents] = await Promise.all(
    CREDIT_DESK_EVENT_TYPES.map((eventName) =>
      getCachedPastEvents(creditDesk.readOnly, eventName, {
        filter: {payer: address, borrower: address},
        fromBlock,
        toBlock: currentBlock.number,
      })
    )
  )
  const creditDeskEvents = _.compact(_.concat(paymentEvents, drawdownEvents))
  return mapEventsToTx<CreditDeskEventType>(creditDeskEvents, CREDIT_DESK_EVENT_TYPES, {
    parseName: (eventData: KnownEventData<CreditDeskEventType>) => {
      switch (eventData.event) {
        case PAYMENT_COLLECTED_EVENT:
          return PAYMENT_TX_TYPE
        case DRAWDOWN_MADE_EVENT:
          return BORROW_TX_TYPE
        default:
          return assertUnreachable(eventData.event)
      }
    },
    parseAmount: (eventData: KnownEventData<CreditDeskEventType>) => {
      switch (eventData.event) {
        case PAYMENT_COLLECTED_EVENT:
          return {
            amount: eventData.returnValues.paymentAmount,
            units: "usdc",
          }
        case DRAWDOWN_MADE_EVENT:
          return {
            amount: eventData.returnValues.drawdownAmount,
            units: "usdc",
          }
        default:
          return assertUnreachable(eventData.event)
      }
    },
  })
}

async function getOverlappingStakingRewardsEventsForUser(
  address: string,
  stakingRewards: StakingRewardsLoaded
): Promise<WithCurrentBlock<{value: KnownEventData<StakingRewardsEventType>[]}>> {
  return {
    currentBlock: stakingRewards.info.value.currentBlock,
    value: await stakingRewards.getEventsFromUser(
      address,
      STAKING_REWARDS_EVENT_TYPES,
      undefined,
      stakingRewards.info.value.currentBlock.number
    ),
  }
}

function getNonOverlappingStakingRewardsEvents(
  overlappingStakingRewardsEvents: KnownEventData<StakingRewardsEventType>[]
): KnownEventData<StakingRewardsEventType>[] {
  // We want to eliminate `STAKED_EVENT`s and `UNSTAKED_EVENTS` that are redundant with a corresponding
  // `DEPOSITED_AND_STAKED_EVENT`, or `UNSTAKED_AND_WITHDREW_EVENT` or `UNSTAKED_AND_WITHDREW_MULTIPLE_EVENT`,
  // respectively. To do that, we make an ASSUMPTION: that only one such event and its corresponding
  // event can have been emitted in a given transaction. In practice, this assumption is not guaranteed
  // to be true, because there's nothing to stop someone from performing multiple stakings or unstakings
  // in one transaction using a multi-send contract. But the assumption is true for transactions created
  // using our frontend, which is all we need to worry about supporting here.
  const reduced = overlappingStakingRewardsEvents.reduce<OverlapAccumulator>(
    (acc, curr) => {
      switch (curr.event) {
        case STAKED_EVENT:
          break
        case DEPOSITED_AND_STAKED_EVENT:
          acc.depositedAndStaked[curr.blockNumber] = acc.depositedAndStaked[curr.blockNumber] || {}
          acc.depositedAndStaked[curr.blockNumber]![curr.transactionIndex] = true
          break
        case DEPOSITED_TO_CURVE_EVENT:
          break
        case DEPOSITED_TO_CURVE_AND_STAKED_EVENT:
          acc.depositedToCurveAndStaked[curr.blockNumber] = acc.depositedToCurveAndStaked[curr.blockNumber] || {}
          acc.depositedToCurveAndStaked[curr.blockNumber]![curr.transactionIndex] = true
          break
        case UNSTAKED_EVENT:
          break
        case UNSTAKED_AND_WITHDREW_EVENT:
          acc.unstakedAndWithdrew[curr.blockNumber] = acc.unstakedAndWithdrew[curr.blockNumber] || {}
          acc.unstakedAndWithdrew[curr.blockNumber]![curr.transactionIndex] = true
          break
        case UNSTAKED_MULTIPLE_EVENT:
          acc.unstakedMultiple[curr.blockNumber] = acc.unstakedMultiple[curr.blockNumber] || {}
          acc.unstakedMultiple[curr.blockNumber]![curr.transactionIndex] = true
          break
        case UNSTAKED_AND_WITHDREW_MULTIPLE_EVENT:
          acc.unstakedAndWithdrewMultiple[curr.blockNumber] = acc.unstakedAndWithdrewMultiple[curr.blockNumber] || {}
          acc.unstakedAndWithdrewMultiple[curr.blockNumber]![curr.transactionIndex] = true
          break
        case REWARD_PAID_EVENT:
          break
        default:
          assertUnreachable(curr.event)
      }
      return acc
    },
    {
      depositedAndStaked: {},
      depositedToCurveAndStaked: {},
      unstakedAndWithdrew: {},
      unstakedMultiple: {},
      unstakedAndWithdrewMultiple: {},
    }
  )
  return overlappingStakingRewardsEvents.filter((eventData): boolean => {
    switch (eventData.event) {
      case STAKED_EVENT:
        return (
          !reduced.depositedAndStaked[eventData.blockNumber]?.[eventData.transactionIndex] &&
          !reduced.depositedToCurveAndStaked[eventData.blockNumber]?.[eventData.transactionIndex]
        )
      case DEPOSITED_AND_STAKED_EVENT:
      case DEPOSITED_TO_CURVE_EVENT:
      case DEPOSITED_TO_CURVE_AND_STAKED_EVENT:
        return true
      case UNSTAKED_EVENT:
        return (
          !reduced.unstakedAndWithdrew[eventData.blockNumber]?.[eventData.transactionIndex] &&
          !reduced.unstakedAndWithdrewMultiple[eventData.blockNumber]?.[eventData.transactionIndex] &&
          !reduced.unstakedMultiple[eventData.blockNumber]?.[eventData.transactionIndex]
        )
      case UNSTAKED_AND_WITHDREW_EVENT:
      case UNSTAKED_AND_WITHDREW_MULTIPLE_EVENT:
      case UNSTAKED_MULTIPLE_EVENT:
      case REWARD_PAID_EVENT:
        return true
      default:
        return assertUnreachable(eventData.event)
    }
  })
}

type CorrespondingExistsInfo = {
  [blockNumber: number]: {
    [txIndex: number]: true
  }
}

type OverlapAccumulator = {
  depositedAndStaked: CorrespondingExistsInfo
  depositedToCurveAndStaked: CorrespondingExistsInfo
  unstakedAndWithdrew: CorrespondingExistsInfo
  unstakedMultiple: CorrespondingExistsInfo
  unstakedAndWithdrewMultiple: CorrespondingExistsInfo
}

async function getAndTransformCommunityRewardsEvents(
  address: string,
  communityRewards: CommunityRewardsLoaded
): Promise<HistoricalTx<CommunityRewardsEventType>[]> {
  return communityRewards
    .getEvents(address, COMMUNITY_REWARDS_EVENT_TYPES, undefined, communityRewards.info.value.currentBlock.number)
    .then((events) =>
      mapEventsToTx(events, COMMUNITY_REWARDS_EVENT_TYPES, {
        parseName: (eventData: KnownEventData<CommunityRewardsEventType>) => {
          switch (eventData.event) {
            case REWARD_PAID_EVENT:
              return CLAIM_TX_TYPE
            default:
              return assertUnreachable(eventData.event)
          }
        },
        parseAmount: (eventData: KnownEventData<CommunityRewardsEventType>) => {
          switch (eventData.event) {
            case REWARD_PAID_EVENT:
              return {
                amount: eventData.returnValues.reward,
                units: "gfi",
              }
            default:
              return assertUnreachable(eventData.event)
          }
        },
      })
    )
}

async function getAndTransformMerkleDistributorEvents(
  address: string,
  merkleDistributor: MerkleDistributorLoaded
): Promise<HistoricalTx<MerkleDistributorEventType>[]> {
  return merkleDistributor
    .getEvents(address, MERKLE_DISTRIBUTOR_EVENT_TYPES, undefined, merkleDistributor.info.value.currentBlock.number)
    .then((events) =>
      mapEventsToTx(events, MERKLE_DISTRIBUTOR_EVENT_TYPES, {
        parseName: (eventData: KnownEventData<MerkleDistributorEventType>) => {
          switch (eventData.event) {
            case GRANT_ACCEPTED_EVENT:
              return ACCEPT_TX_TYPE
            default:
              return assertUnreachable(eventData.event)
          }
        },
        parseAmount: (eventData: KnownEventData<MerkleDistributorEventType>) => {
          switch (eventData.event) {
            case GRANT_ACCEPTED_EVENT:
              return {
                amount: eventData.returnValues.amount,
                units: "gfi",
              }
            default:
              return assertUnreachable(eventData.event)
          }
        },
      })
    )
}

async function getAndTransformMerkleDirectDistributorEvents(
  address: string,
  merkleDirectDistributor: MerkleDirectDistributorLoaded
): Promise<HistoricalTx<MerkleDirectDistributorEventType>[]> {
  return merkleDirectDistributor
    .getEvents(
      address,
      MERKLE_DIRECT_DISTRIBUTOR_EVENT_TYPES,
      undefined,
      merkleDirectDistributor.info.value.currentBlock.number
    )
    .then((events) =>
      mapEventsToTx(events, MERKLE_DIRECT_DISTRIBUTOR_EVENT_TYPES, {
        parseName: (eventData: KnownEventData<MerkleDirectDistributorEventType>) => {
          switch (eventData.event) {
            case GRANT_ACCEPTED_EVENT:
              return ACCEPT_TX_TYPE
            default:
              return assertUnreachable(eventData.event)
          }
        },
        parseAmount: (eventData: KnownEventData<MerkleDirectDistributorEventType>) => {
          switch (eventData.event) {
            case GRANT_ACCEPTED_EVENT:
              return {
                amount: eventData.returnValues.amount,
                units: "gfi",
              }
            default:
              return assertUnreachable(eventData.event)
          }
        },
      })
    )
}

async function getAndTransformBackerMerkleDistributorEvents(
  address: string,
  backerMerkleDistributor: BackerMerkleDistributorLoaded
): Promise<HistoricalTx<BackerMerkleDistributorEventType>[]> {
  return getAndTransformMerkleDistributorEvents(address, backerMerkleDistributor)
}

async function getAndTransformBackerMerkleDirectDistributorEvents(
  address: string,
  backerMerkleDirectDistributor: BackerMerkleDirectDistributorLoaded
): Promise<HistoricalTx<BackerMerkleDirectDistributorEventType>[]> {
  return getAndTransformMerkleDirectDistributorEvents(address, backerMerkleDirectDistributor)
}
