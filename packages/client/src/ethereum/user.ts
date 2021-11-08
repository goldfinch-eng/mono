import {
  GrantReason,
  MerkleDistributorGrantInfo,
} from "@goldfinch-eng/protocol/blockchain_scripts/merkleDistributor/types"
import {CreditDesk} from "@goldfinch-eng/protocol/typechain/web3/CreditDesk"
import {GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/web3/GoldfinchConfig"
import BigNumber from "bignumber.js"
import _ from "lodash"
import {EventData} from "web3-eth-contract"
import {assertWithLoadedInfo, Loadable, WithLoadedInfo} from "../types/loadable"
import {assertNonNullable, BlockInfo} from "../utils"
import {BorrowerInterface, getBorrowerContract} from "./borrower"
import {CommunityRewardsGrant, CommunityRewardsLoaded, MerkleDistributorLoaded} from "./communityRewards"
import {ERC20, Tickers, usdcFromAtomic} from "./erc20"
import {getBalanceAsOf, mapEventsToTx} from "./events"
import {GFILoaded} from "./gfi"
import {GoldfinchProtocol} from "./GoldfinchProtocol"
import {SeniorPoolLoaded, StakingRewardsLoaded, StakingRewardsPosition, StoredPosition} from "./pool"
import {getFromBlock, MAINNET} from "./utils"
import {Go} from "@goldfinch-eng/protocol/typechain/web3/Go"
import {GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/web3/GoldfinchConfig"
import {UniqueIdentity} from "@goldfinch-eng/protocol/typechain/web3/UniqueIdentity"

declare let window: any

export const UNLOCK_THRESHOLD = new BigNumber(10000)

export async function getUserData(
  address: string,
  goldfinchProtocol: GoldfinchProtocol,
  pool: SeniorPoolLoaded,
  creditDesk: CreditDesk,
  networkId: string,
  stakingRewards: StakingRewardsLoaded,
  gfi: GFILoaded,
  communityRewards: CommunityRewardsLoaded,
  merkleDistributor: MerkleDistributorLoaded,
  currentBlock: BlockInfo
): Promise<UserLoaded> {
  const borrower = await getBorrowerContract(address, goldfinchProtocol, currentBlock)

  const user = new User(address, networkId, creditDesk, goldfinchProtocol, borrower)
  await user.initialize(pool, stakingRewards, gfi, communityRewards, merkleDistributor, currentBlock)
  assertWithLoadedInfo(user)
  return user
}

export interface UnlockedStatus {
  unlockAddress: string
  isUnlocked: boolean
}

type UserStakingRewardsLoadedInfo = {
  currentBlock: BlockInfo
  positions: StakingRewardsPosition[]
  claimable: BigNumber
  unvested: BigNumber
  granted: BigNumber
}

class UserStakingRewards {
  info: Loadable<UserStakingRewardsLoadedInfo>

  constructor() {
    this.info = {
      loaded: false,
      value: undefined,
    }
  }

  async initialize(address: string, stakingRewards: StakingRewardsLoaded, currentBlock: BlockInfo): Promise<void> {
    if (stakingRewards.info.value.currentBlock.number !== currentBlock.number) {
      throw new Error("`stakingRewards` is based on a different block number from `currentBlock`.")
    }
    // NOTE: In defining `positions`, we want to use `balanceOf()` plus `tokenOfOwnerByIndex()`
    // to determine `tokenIds`, rather than using the set of Staked events for the `recipient`.
    // The former approach reflects any token transfers that may have occurred to or from the
    // `recipient`, whereas the latter does not.
    const positions = await stakingRewards.contract.methods
      .balanceOf(address)
      .call(undefined, currentBlock.number)
      .then((balance: string) => {
        const numPositions = parseInt(balance, 10)
        return numPositions
      })
      .then((numPositions: number) =>
        Promise.all(
          Array(numPositions)
            .fill("")
            .map((val, i) =>
              stakingRewards.contract.methods.tokenOfOwnerByIndex(address, i).call(undefined, currentBlock.number)
            )
        )
      )
      .then((tokenIds: string[]) =>
        Promise.all([
          tokenIds,
          Promise.all(
            tokenIds.map((tokenId) =>
              stakingRewards.contract.methods
                .positions(tokenId)
                .call(undefined, currentBlock.number)
                .then(async (rawPosition) => {
                  const storedPosition = UserStakingRewards.parseStoredPosition(rawPosition)
                  const optimisticIncrement = await stakingRewards.calculatePositionOptimisticIncrement(
                    tokenId,
                    storedPosition.rewards,
                    currentBlock
                  )
                  return {storedPosition, optimisticIncrement}
                })
            )
          ),
          Promise.all(
            tokenIds.map(async (tokenId) => {
              const stakedEvent = await stakingRewards.getStakedEvent(address, tokenId, currentBlock.number)
              if (!stakedEvent) {
                throw new Error(`Failed to retrieve Staked event for tokenId: ${tokenId}`)
              }
              return stakedEvent
            })
          ),
          Promise.all(
            tokenIds.map((tokenId) =>
              stakingRewards.contract.methods.positionCurrentEarnRate(tokenId).call(undefined, currentBlock.number)
            )
          ),
        ])
      )
      .then(([tokenIds, storedAndIncrements, stakedEvents, currentEarnRates]) => {
        return tokenIds.map((tokenId, i) => {
          const storedAndIncrement = storedAndIncrements[i]
          assertNonNullable(storedAndIncrement)
          const {storedPosition, optimisticIncrement} = storedAndIncrement
          const stakedEvent = stakedEvents[i]
          assertNonNullable(stakedEvent)
          const currentEarnRate = currentEarnRates[i]
          assertNonNullable(currentEarnRate)
          return new StakingRewardsPosition(
            tokenId,
            stakedEvent,
            new BigNumber(currentEarnRate),
            storedPosition,
            optimisticIncrement
          )
        })
      })

    const claimable = UserStakingRewards.calculateClaimableRewards(positions)
    const unvested = UserStakingRewards.calculateUnvestedRewards(positions)
    const granted = UserStakingRewards.calculateGrantedRewards(positions)

    this.info = {
      loaded: true,
      value: {
        currentBlock,
        positions,
        claimable,
        unvested,
        granted,
      },
    }
  }

  get lockedPositions(): StakingRewardsPosition[] {
    // We expect this getter to be used only once info has been loaded.
    assertWithLoadedInfo(this)
    const value = this.info.value
    return value.positions.filter((position) => position.getLocked(value.currentBlock))
  }

  get unlockedPositions(): StakingRewardsPosition[] {
    // We expect this getter to be used only once info has been loaded.
    assertWithLoadedInfo(this)
    const value = this.info.value
    return value.positions.filter((position) => !position.getLocked(value.currentBlock))
  }

  get unvestedRewardsPositions(): StakingRewardsPosition[] {
    assertWithLoadedInfo(this)
    const value = this.info.value
    return value.positions.filter((position) => position.storedPosition.rewards.endTime > value.currentBlock.timestamp)
  }

  static calculateClaimableRewards(positions: StakingRewardsPosition[]): BigNumber {
    if (positions.length === 0) return new BigNumber(0)
    return BigNumber.sum.apply(
      null,
      positions.map((position) => position.claimable)
    )
  }

  static calculateUnvestedRewards(positions: StakingRewardsPosition[]): BigNumber {
    if (positions.length === 0) return new BigNumber(0)
    return BigNumber.sum.apply(
      null,
      positions.map((position) => position.unvested)
    )
  }

  static calculateGrantedRewards(positions: StakingRewardsPosition[]): BigNumber {
    if (positions.length === 0) return new BigNumber(0)
    return BigNumber.sum.apply(
      null,
      positions.map((position) => position.granted)
    )
  }

  static parseStoredPosition(tuple: {
    0: string
    1: [string, string, string, string, string, string]
    2: string
    3: string
  }): StoredPosition {
    return {
      amount: new BigNumber(tuple[0]),
      rewards: {
        totalUnvested: new BigNumber(tuple[1][0]),
        totalVested: new BigNumber(tuple[1][1]),
        totalPreviouslyVested: new BigNumber(tuple[1][2]),
        totalClaimed: new BigNumber(tuple[1][3]),
        startTime: parseInt(tuple[1][4], 10),
        endTime: parseInt(tuple[1][5], 10),
      },
      leverageMultiplier: new BigNumber(tuple[2]),
      lockedUntil: parseInt(tuple[3], 10),
    }
  }
}

export type UserStakingRewardsLoaded = WithLoadedInfo<UserStakingRewards, UserStakingRewardsLoadedInfo>

type UserCommunityRewardsLoadedInfo = {
  currentBlock: BlockInfo
  grants: CommunityRewardsGrant[]
  claimable: BigNumber
  unvested: BigNumber
  granted: BigNumber
}

class UserCommunityRewards {
  goldfinchProtocol: GoldfinchProtocol
  info: Loadable<UserCommunityRewardsLoadedInfo>

  constructor(goldfinchProtocol: GoldfinchProtocol) {
    this.goldfinchProtocol = goldfinchProtocol
    this.info = {
      loaded: false,
      value: undefined,
    }
  }

  async initialize(
    address: string,
    communityRewards: CommunityRewardsLoaded,
    merkleDistributor: MerkleDistributorLoaded,
    userMerkleDistributor: UserMerkleDistributorLoaded,
    currentBlock: BlockInfo
  ): Promise<void> {
    if (communityRewards.info.value.currentBlock.number !== currentBlock.number) {
      throw new Error("`communityRewards` is based on a different block number from `currentBlock`.")
    }
    if (merkleDistributor.info.value.currentBlock.number !== currentBlock.number) {
      throw new Error("`merkleDistributor` is based on a different block number from `currentBlock`.")
    }
    if (userMerkleDistributor.info.value.currentBlock.number !== currentBlock.number) {
      throw new Error("`userMerkleDistributor` is based on a different block number from `currentBlock`.")
    }

    // NOTE: In defining `grants`, we want to use `balanceOf()` plus `tokenOfOwnerByIndex`
    // to determine `tokenIds`, rather than using the set of Granted events for the `recipient`.
    // The former approach reflects any token transfers that may have occurred to or from the
    // `recipient`, whereas the latter does not.
    const grants = await communityRewards.contract.methods
      .balanceOf(address)
      .call(undefined, currentBlock.number)
      .then((balance: string) => parseInt(balance, 10))
      .then((numPositions: number) =>
        Promise.all(
          Array(numPositions)
            .fill("")
            .map((val, i) =>
              communityRewards.contract.methods.tokenOfOwnerByIndex(address, i).call(undefined, currentBlock.number)
            )
        )
      )
      .then((tokenIds: string[]) =>
        Promise.all([
          tokenIds,
          Promise.all(
            tokenIds.map((tokenId) =>
              communityRewards.contract.methods.grants(tokenId).call(undefined, currentBlock.number)
            )
          ),
          Promise.all(
            tokenIds.map((tokenId) =>
              communityRewards.contract.methods.claimableRewards(tokenId).call(undefined, currentBlock.number)
            )
          ),
          Promise.all(
            tokenIds.map(async (tokenId) => {
              const events = await this.goldfinchProtocol.queryEvent(
                merkleDistributor.contract,
                "GrantAccepted",
                {tokenId},
                currentBlock.number
              )
              if (events.length === 1) {
                const grantAcceptedEvent = events[0]
                assertNonNullable(grantAcceptedEvent)
                const airdrop = userMerkleDistributor.info.value.airdrops.accepted.find(
                  (airdrop) => parseInt(grantAcceptedEvent.returnValues.index, 10) === airdrop.index
                )
                if (airdrop) {
                  return airdrop.reason
                } else {
                  throw new Error(
                    `Failed to identify airdrop corresponding to GrantAccepted event ${tokenId}, among user's accepted airdrops.`
                  )
                }
              } else if (events.length === 0) {
                // This is not necessarily an error, because in theory it's possible the grant was accepted
                // not via the `MerkleDistributor.acceptGrant()`, but instead by having been issued directly
                // via `CommunityRewards.grant()`.
                console.warn(
                  `Failed to identify GrantAccepted event corresponding to CommunityRewards grant ${tokenId}.`
                )
                return
              } else {
                throw new Error(
                  `Identified more than one GrantAccepted event corresponding to CommunityRewards grant ${tokenId}.`
                )
              }
            })
          ),
        ])
      )
      .then(([tokenIds, rawGrants, claimables, reasons]) =>
        tokenIds.map((tokenId, i): CommunityRewardsGrant => {
          const rawGrant = rawGrants[i]
          assertNonNullable(rawGrant)
          const claimable = claimables[i]
          assertNonNullable(claimable)
          const reason = reasons[i]
          return UserCommunityRewards.parseCommunityRewardsGrant(tokenId, new BigNumber(claimable), rawGrant, reason)
        })
      )

    const claimable = UserCommunityRewards.calculateClaimable(grants)
    const unvested = UserCommunityRewards.calculateUnvested(grants)
    const granted = UserCommunityRewards.calculateGranted(grants)

    this.info = {
      loaded: true,
      value: {
        currentBlock,
        grants,
        claimable,
        unvested,
        granted,
      },
    }
  }

  static calculateClaimable(grants: CommunityRewardsGrant[]): BigNumber {
    if (grants.length === 0) return new BigNumber(0)
    const claimableResults = grants.map((grant) => grant.claimable)
    return BigNumber.sum.apply(null, claimableResults)
  }

  static calculateUnvested(grants: CommunityRewardsGrant[]): BigNumber {
    if (grants.length === 0) return new BigNumber(0)
    return BigNumber.sum.apply(
      null,
      grants.map((grant) => grant.unvested)
    )
  }

  static calculateGranted(grants: CommunityRewardsGrant[]): BigNumber {
    if (grants.length === 0) return new BigNumber(0)
    return BigNumber.sum.apply(
      null,
      grants.map((grant) => grant.granted)
    )
  }

  static parseCommunityRewardsGrant(
    tokenId: string,
    claimable: BigNumber,
    tuple: {
      0: string
      1: string
      2: string
      3: string
      4: string
      5: string
      6: string
    },
    reason: GrantReason | undefined
  ): CommunityRewardsGrant {
    return new CommunityRewardsGrant(
      tokenId,
      claimable,
      {
        totalGranted: new BigNumber(tuple[0]),
        totalClaimed: new BigNumber(tuple[1]),
        startTime: parseInt(tuple[2], 10),
        endTime: parseInt(tuple[3], 10),
        cliffLength: new BigNumber(tuple[4]),
        vestingInterval: new BigNumber(tuple[5]),
        revokedAt: parseInt(tuple[6], 10),
      },
      reason
    )
  }
}

export type UserCommunityRewardsLoaded = WithLoadedInfo<UserCommunityRewards, UserCommunityRewardsLoadedInfo>

type UserMerkleDistributorLoadedInfo = {
  currentBlock: BlockInfo
  airdrops: {
    accepted: MerkleDistributorGrantInfo[]
    notAccepted: MerkleDistributorGrantInfo[]
  }
}

class UserMerkleDistributor {
  info: Loadable<UserMerkleDistributorLoadedInfo>

  constructor() {
    this.info = {
      loaded: false,
      value: undefined,
    }
  }

  async initialize(
    address: string,
    merkleDistributor: MerkleDistributorLoaded,
    currentBlock: BlockInfo
  ): Promise<void> {
    if (merkleDistributor.info.value.currentBlock.number !== currentBlock.number) {
      throw new Error("`merkleDistributor` is based on a different block number from `currentBlock`.")
    }

    const airdropsForRecipient = UserMerkleDistributor.getAirdropsForRecipient(
      merkleDistributor.info.value.merkleDistributorInfo.grants,
      address
    )
    const withAcceptance = await Promise.all(
      airdropsForRecipient.map(async (grantInfo) => ({
        grantInfo,
        isAccepted: await merkleDistributor.contract.methods
          .isGrantAccepted(grantInfo.index)
          .call(undefined, currentBlock.number),
      }))
    )
    const airdrops = withAcceptance.reduce<{
      accepted: MerkleDistributorGrantInfo[]
      notAccepted: MerkleDistributorGrantInfo[]
    }>(
      (acc, curr) => {
        if (curr.isAccepted) {
          acc.accepted.push(curr.grantInfo)
        } else {
          acc.notAccepted.push(curr.grantInfo)
        }
        return acc
      },
      {accepted: [], notAccepted: []}
    )

    this.info = {
      loaded: true,
      value: {
        currentBlock,
        airdrops,
      },
    }
  }

  static getAirdropsForRecipient(
    allAirdrops: MerkleDistributorGrantInfo[],
    recipient: string
  ): MerkleDistributorGrantInfo[] {
    return allAirdrops.filter((grantInfo) => grantInfo.account === recipient)
  }
}

export type UserMerkleDistributorLoaded = WithLoadedInfo<UserMerkleDistributor, UserMerkleDistributorLoadedInfo>

type UserLoadedInfo = {
  currentBlock: BlockInfo
  usdcBalance: BigNumber
  usdcBalanceInDollars: BigNumber
  poolAllowance: BigNumber
  poolEvents: EventData[]
  pastTxs: any[]
  poolTxs: any[]
  goListed: boolean
  legacyGolisted: boolean
  hasUID: boolean
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
  communityRewards: UserCommunityRewardsLoaded
  merkleDistributor: UserMerkleDistributorLoaded
}

export type UserLoaded = WithLoadedInfo<User, UserLoadedInfo>

export class User {
  address: string
  web3Connected: boolean
  networkId: string
  noWeb3: boolean
  borrower: BorrowerInterface | undefined
  info: Loadable<UserLoadedInfo>

  goldfinchProtocol: GoldfinchProtocol

  private creditDesk: CreditDesk

  constructor(
    address: string,
    networkId: string,
    creditDesk: CreditDesk,
    goldfinchProtocol: GoldfinchProtocol,
    borrower: BorrowerInterface | undefined
  ) {
    if (!address) {
      throw new Error("User must have an address.")
    }
    this.address = address
    this.web3Connected = true
    this.networkId = networkId
    this.noWeb3 = !window.ethereum
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
    currentBlock: BlockInfo
  ) {
    if (pool.info.value.currentBlock.number !== currentBlock.number) {
      throw new Error("`pool` is based on a different block number from `currentBlock`.")
    }
    if (pool.info.value.currentBlock.number !== stakingRewards.info.value.currentBlock.number) {
      throw new Error("`pool` and `stakingRewards` are based on different block numbers.")
    }
    if (pool.info.value.currentBlock.number !== gfi.info.value.currentBlock.number) {
      throw new Error("`pool` and `gfi` are based on different block numbers.")
    }
    if (pool.info.value.currentBlock.number !== communityRewards.info.value.currentBlock.number) {
      throw new Error("`pool` and `communityRewards` are based on different block numbers.")
    }
    if (pool.info.value.currentBlock.number !== merkleDistributor.info.value.currentBlock.number) {
      throw new Error("`pool` and `merkleDistributor` are based on different block numbers.")
    }

    const usdc = this.goldfinchProtocol.getERC20(Tickers.USDC)

    const usdcBalance = await usdc.getBalance(this.address, currentBlock)
    const usdcBalanceInDollars = new BigNumber(usdcFromAtomic(usdcBalance))
    const poolAllowance = await usdc.getAllowance({owner: this.address, spender: pool.address}, currentBlock)

    const [usdcTxs, poolEvents, creditDeskTxs] = await Promise.all([
      // NOTE: We have no need to include usdc txs for `pool.v1Pool` among the txs in
      // `this.pastTxs`. So we don't get them. We only need usdc txs for `this.pool`.
      getAndTransformERC20Events(usdc, pool.address, this.address, currentBlock),
      getPoolEvents(pool, this.address, currentBlock),
      // Credit desk events could've come from the user directly or the borrower contract, we need to filter by both
      getAndTransformCreditDeskEvents(
        this.creditDesk,
        _.compact([this.address, this.borrower?.borrowerAddress]),
        currentBlock
      ),
    ])
    const poolTxs = await mapEventsToTx(poolEvents)
    const pastTxs = _.reverse(_.sortBy(_.compact(_.concat(usdcTxs, poolTxs, creditDeskTxs)), "blockNumber"))

    const golistStatus = await this.fetchGolistStatus(this.address, currentBlock)
    const goListed = golistStatus.golisted
    const legacyGolisted = golistStatus.legacyGolisted
    const hasUID = golistStatus.hasUID

    const gfiBalance = new BigNumber(
      await gfi.contract.methods.balanceOf(this.address).call(undefined, currentBlock.number)
    )

    const userStakingRewards = new UserStakingRewards()
    const userMerkleDistributor = new UserMerkleDistributor()

    await Promise.all([
      userStakingRewards.initialize(this.address, stakingRewards, currentBlock),
      userMerkleDistributor.initialize(this.address, merkleDistributor, currentBlock),
    ])
    assertWithLoadedInfo(userStakingRewards)
    assertWithLoadedInfo(userMerkleDistributor)

    const userCommunityRewards = new UserCommunityRewards(this.goldfinchProtocol)
    await userCommunityRewards.initialize(
      this.address,
      communityRewards,
      merkleDistributor,
      userMerkleDistributor,
      currentBlock
    )
    assertWithLoadedInfo(userCommunityRewards)

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
        legacyGolisted,
        hasUID,
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
        communityRewards: userCommunityRewards,
        merkleDistributor: userMerkleDistributor,
      },
    }
  }

  isUnlocked(allowance: BigNumber | undefined) {
    return !allowance || allowance.gte(UNLOCK_THRESHOLD)
  }

  private async fetchGolistStatus(address: string, currentBlock: BlockInfo) {
    if (process.env.REACT_APP_ENFORCE_GO_LIST || this.networkId === MAINNET) {
      const config = this.goldfinchProtocol.getContract<GoldfinchConfig>("GoldfinchConfig")
      const legacyGolisted = await config.methods.goList(address).call(undefined, currentBlock.number)

      const go = this.goldfinchProtocol.getContract<Go>("Go")
      const golisted = await go.methods.go(address).call(undefined, currentBlock.number)

      const uniqueIdentity = this.goldfinchProtocol.getContract<UniqueIdentity>("UniqueIdentity")
      const hasUID = !new BigNumber(
        await uniqueIdentity.methods.balanceOf(address, 0).call(undefined, currentBlock.number)
      ).isZero()

      return {
        legacyGolisted,
        golisted,
        hasUID,
      }
    } else {
      return {
        legacyGolisted: true,
        golisted: true,
        hasUID: true,
      }
    }
  }

  poolBalanceAsOf(blockNumExclusive: number): BigNumber {
    assertWithLoadedInfo(this)
    return getBalanceAsOf(this.info.value.poolEvents, blockNumExclusive, "WithdrawalMade")
  }
}

async function getAndTransformERC20Events(erc20: ERC20, spender: string, owner: string, currentBlock: BlockInfo) {
  let approvalEvents = await erc20.contract.getPastEvents("Approval", {
    filter: {owner, spender},
    fromBlock: "earliest",
    toBlock: currentBlock.number,
  })
  approvalEvents = _.chain(approvalEvents)
    .compact()
    .map((e) => _.set(e, "erc20", erc20))
    .value()
  return await mapEventsToTx(approvalEvents)
}

async function getPoolEvents(pool: SeniorPoolLoaded, address: string, currentBlock: BlockInfo) {
  return await pool.getPoolEvents(address, ["DepositMade", "WithdrawalMade"], true, currentBlock.number)
}

async function getAndTransformCreditDeskEvents(creditDesk, address, currentBlock: BlockInfo) {
  const fromBlock = getFromBlock(creditDesk.chain)
  const [paymentEvents, drawdownEvents] = await Promise.all(
    ["PaymentCollected", "DrawdownMade"].map((eventName) => {
      return creditDesk.getPastEvents(eventName, {
        filter: {payer: address, borrower: address},
        fromBlock: fromBlock,
        to: currentBlock.number,
      })
    })
  )
  const creditDeskEvents = _.compact(_.concat(paymentEvents, drawdownEvents))
  return await mapEventsToTx(creditDeskEvents)
}
