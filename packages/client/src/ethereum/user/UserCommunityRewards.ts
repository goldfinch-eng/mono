import BigNumber from "bignumber.js"
import {GRANT_ACCEPTED_EVENT, KnownEventData} from "../../types/events"
import {Loadable, WithLoadedInfo} from "../../types/loadable"
import {assertNonNullable, BlockInfo, defaultSum} from "../../utils"
import {BackerMerkleDistributorLoaded} from "../backerMerkleDistributor"
import {
  CommunityRewardsGrant,
  CommunityRewardsGrantAcceptanceContext,
  CommunityRewardsLoaded,
} from "../communityRewards"
import {GoldfinchProtocol} from "../GoldfinchProtocol"
import {MerkleDistributorLoaded} from "../merkleDistributor"
import {UserBackerMerkleDistributorLoaded} from "./UserBackerMerkleDistributor"
import {UserMerkleDistributorLoaded} from "./UserMerkleDistributor"

export type UserCommunityRewardsLoaded = WithLoadedInfo<UserCommunityRewards, UserCommunityRewardsLoadedInfo>

export type UserCommunityRewardsLoadedInfo = {
  currentBlock: BlockInfo
  grants: CommunityRewardsGrant[]
  claimable: BigNumber
  unvested: BigNumber
  granted: BigNumber
}

export class UserCommunityRewards {
  address: string
  goldfinchProtocol: GoldfinchProtocol
  info: Loadable<UserCommunityRewardsLoadedInfo>

  constructor(address: string, goldfinchProtocol: GoldfinchProtocol) {
    if (!address) {
      throw new Error("User must have an address.")
    }
    this.address = address
    this.goldfinchProtocol = goldfinchProtocol
    this.info = {
      loaded: false,
      value: undefined,
    }
  }

  async initialize(
    communityRewards: CommunityRewardsLoaded,
    merkleDistributor: MerkleDistributorLoaded,
    backerMerkleDistributor: BackerMerkleDistributorLoaded,
    userMerkleDistributor: UserMerkleDistributorLoaded,
    userBackerMerkleDistributor: UserBackerMerkleDistributorLoaded,
    currentBlock: BlockInfo
  ): Promise<void> {
    // NOTE: In defining `grants`, we want to use `balanceOf()` plus `tokenOfOwnerByIndex`
    // to determine `tokenIds`, rather than using the set of Granted events for the `recipient`.
    // The former approach reflects any token transfers that may have occurred to or from the
    // `recipient`, whereas the latter does not.
    const grants = await communityRewards.contract.readOnly.methods
      .balanceOf(this.address)
      .call(undefined, currentBlock.number)
      .then((balance: string) => parseInt(balance, 10))
      .then((numPositions: number) =>
        Promise.all(
          Array(numPositions)
            .fill("")
            .map((val, i) =>
              communityRewards.contract.readOnly.methods
                .tokenOfOwnerByIndex(this.address, i)
                .call(undefined, currentBlock.number)
            )
        )
      )
      .then((tokenIds: string[]) =>
        Promise.all([
          tokenIds,
          Promise.all(
            tokenIds.map((tokenId) =>
              communityRewards.contract.readOnly.methods.grants(tokenId).call(undefined, currentBlock.number)
            )
          ),
          Promise.all(
            tokenIds.map((tokenId) =>
              communityRewards.contract.readOnly.methods.claimableRewards(tokenId).call(undefined, currentBlock.number)
            )
          ),
          Promise.all(
            tokenIds.map(async (tokenId): Promise<CommunityRewardsGrantAcceptanceContext | undefined> => {
              const {events, source, userDistributor} = await this.getAcceptedEventsForMerkleDistributorScenarios(
                merkleDistributor,
                backerMerkleDistributor,
                tokenId,
                currentBlock,
                userMerkleDistributor,
                userBackerMerkleDistributor
              )

              if (events.length === 1) {
                const acceptanceEvent = events[0]
                assertNonNullable(acceptanceEvent)
                const airdrop = userDistributor.info.value.airdrops.accepted.find(
                  (airdrop) => parseInt(acceptanceEvent.returnValues.index, 10) === airdrop.grantInfo.index
                )
                if (airdrop) {
                  return {
                    grantInfo: airdrop.grantInfo,
                    event: acceptanceEvent,
                    source,
                  }
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
      .then(([tokenIds, rawGrants, claimables, acceptanceContexts]) =>
        tokenIds.map((tokenId, i): CommunityRewardsGrant => {
          const rawGrant = rawGrants[i]
          assertNonNullable(rawGrant)
          const claimable = claimables[i]
          assertNonNullable(claimable)
          const acceptanceContext = acceptanceContexts[i]
          return UserCommunityRewards.parseCommunityRewardsGrant(
            tokenId,
            new BigNumber(claimable),
            rawGrant,
            acceptanceContext
          )
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

  async getAcceptedEventsForMerkleDistributorScenarios(
    merkleDistributor: MerkleDistributorLoaded,
    backerMerkleDistributor: BackerMerkleDistributorLoaded,
    tokenId: string,
    currentBlock: BlockInfo,
    userMerkleDistributor: UserMerkleDistributorLoaded,
    userBackerMerkleDistributor: UserBackerMerkleDistributorLoaded
  ): Promise<
    | {
        events: KnownEventData<typeof GRANT_ACCEPTED_EVENT>[]
        source: "merkleDistributor"
        userDistributor: UserMerkleDistributorLoaded
      }
    | {
        events: KnownEventData<typeof GRANT_ACCEPTED_EVENT>[]
        source: "backerMerkleDistributor"
        userDistributor: UserBackerMerkleDistributorLoaded
      }
  > {
    const merkleDistributorEvents = await this.goldfinchProtocol.queryEvents(
      merkleDistributor.contract.readOnly,
      [GRANT_ACCEPTED_EVENT],
      {tokenId, account: this.address},
      currentBlock.number
    )
    if (merkleDistributorEvents.length === 0) {
      const backerMerkleDistributorEvents = await this.goldfinchProtocol.queryEvents(
        backerMerkleDistributor.contract.readOnly,
        [GRANT_ACCEPTED_EVENT],
        {tokenId, account: this.address},
        currentBlock.number
      )
      return {
        events: backerMerkleDistributorEvents,
        source: "backerMerkleDistributor",
        userDistributor: userBackerMerkleDistributor,
      }
    } else {
      return {events: merkleDistributorEvents, source: "merkleDistributor", userDistributor: userMerkleDistributor}
    }
  }

  static calculateClaimable(grants: CommunityRewardsGrant[]): BigNumber {
    return defaultSum(grants.map((grant) => grant.claimable))
  }

  static calculateUnvested(grants: CommunityRewardsGrant[]): BigNumber {
    return defaultSum(grants.map((grant) => grant.unvested))
  }

  static calculateGranted(grants: CommunityRewardsGrant[]): BigNumber {
    return defaultSum(grants.map((grant) => grant.granted))
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
    acceptanceContext: CommunityRewardsGrantAcceptanceContext | undefined
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
      acceptanceContext
    )
  }
}
