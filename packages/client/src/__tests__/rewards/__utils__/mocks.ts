import "@testing-library/jest-dom"
import {
  MerkleDistributorGrantInfo,
  MerkleDistributorInfo,
} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDistributor/types"
import {MerkleDistributor as MerkleDistributorContract} from "@goldfinch-eng/protocol/typechain/web3/MerkleDistributor"
import {MerkleDirectDistributor as MerkleDirectDistributorContract} from "@goldfinch-eng/protocol/typechain/web3/MerkleDirectDistributor"
import {BackerMerkleDistributor as BackerMerkleDistributorContract} from "@goldfinch-eng/protocol/typechain/web3/BackerMerkleDistributor"
import {BackerMerkleDirectDistributor as BackerMerkleDirectDistributorContract} from "@goldfinch-eng/protocol/typechain/web3/BackerMerkleDirectDistributor"
import "@testing-library/jest-dom"
import {mock} from "@depay/web3-mock"
import {BlockNumber} from "web3-core"
import {Filter} from "web3-eth-contract"
import {BigNumber} from "bignumber.js"
import {CommunityRewards} from "../../../ethereum/communityRewards"
import {GFI, GFI_DECIMALS} from "../../../ethereum/gfi"
import {
  mockGetWeightedAverageSharePrice,
  SeniorPoolLoaded,
  StakedPositionType,
  StakingRewards,
  StakingRewardsLoaded,
} from "../../../ethereum/pool"
import {
  User,
  UserBackerMerkleDirectDistributor,
  UserBackerMerkleDistributor,
  UserMerkleDirectDistributor,
  UserMerkleDistributor,
  UserStakingRewards,
} from "../../../ethereum/user"
import * as utils from "../../../ethereum/utils"
import {GRANT_ACCEPTED_EVENT, KnownEventData, KnownEventName, STAKED_EVENT} from "../../../types/events"
import {BlockInfo} from "../../../utils"
import {
  blockchain,
  defaultCurrentBlock,
  getCommunityRewardsAbi,
  getErc20Abi,
  getDeployments,
  getGfiAbi,
  getMerkleDistributorAbi,
  recipient,
  getStakingRewardsAbi,
  getMerkleDirectDistributorAbi,
  getBackerMerkleDirectDistributorAbi,
  getBackerRewardsAbi,
} from "./constants"
import isEqual from "lodash/isEqual"
import getWeb3 from "../../../web3"
import {
  MerkleDirectDistributorGrantInfo,
  MerkleDirectDistributorInfo,
} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDirectDistributor/types"
import {MerkleDistributor, MerkleDistributorLoaded} from "../../../ethereum/merkleDistributor"
import {MerkleDirectDistributor, MerkleDirectDistributorLoaded} from "../../../ethereum/merkleDirectDistributor"
import {GoldfinchProtocol} from "../../../ethereum/GoldfinchProtocol"
import {BackerMerkleDirectDistributor} from "../../../ethereum/backerMerkleDirectDistributor"
import {BackerMerkleDistributor} from "../../../ethereum/backerMerkleDistributor"
import {BackerRewards} from "../../../ethereum/backerRewards"

class ImproperlyConfiguredMockError extends Error {}

export interface MerkleDistributorConfigMock {
  distributor?: {
    airdrop: MerkleDistributorGrantInfo | undefined
    isAccepted: boolean
  }
  backerDistributor?: {
    airdrop: MerkleDistributorGrantInfo | undefined
    isAccepted: boolean
  }
}

export interface MerkleDirectDistributorConfigMock {
  distributor?: {
    airdrop: MerkleDirectDistributorGrantInfo | undefined
    isAccepted: boolean
  }
  backerDistributor?: {
    airdrop: MerkleDirectDistributorGrantInfo | undefined
    isAccepted: boolean
  }
}

export interface RewardsMockData {
  currentBlock: BlockInfo
  staking?: {
    earnedSinceLastCheckpoint?: string
    totalVestedAt?: string
    granted?: string
    positionCurrentEarnRate?: string
    positionsRes?: {
      0: string
      1: [string, string, string, string, string, string]
      2: string
      3: string
      4: string
      5: string
      6: string
    }
    stakingRewardsBalance?: number
    stakingRewardsTokenId?: string
  }
  tokenLaunchTime?: string
  community?: {
    airdrop?: MerkleDistributorGrantInfo
    grantRes?: {
      0: string
      1: string
      2: string
      3: string
      4: string
      5: string
      6: string
    }
    claimable?: string
    acceptedGrantRes?: {
      returnValues: {
        index: number
        account: string
      }
    }
    isFromBacker?: boolean
  }
  notAcceptedMerkleDistributorGrant?: {
    amount: string
    vestingLength: string
    cliffLength: string
    vestingInterval: string
    revokedAt: string
    totalVestedAt: string
  }
  gfi?: {
    gfiBalance?: string
  }
  backer?: {
    poolTokenInfos: Array<{
      id: string
      poolTokenClaimableRewards: string
      stakingRewardsEarnedSinceLastWithdraw: string
      backerRewardsTokenInfo: [string, string]
      stakingRewardsClaimed: string
    }>
  }
}

type ContractCallMocks = {
  callGFIBalanceMock: ReturnType<typeof mock>
  callUSDCBalanceMock: ReturnType<typeof mock>
  callUSDCAllowanceMock: ReturnType<typeof mock>
  callStakingRewardsBalanceMock: ReturnType<typeof mock>
  callCommunityRewardsTokenLaunchTimeInSecondsMock: ReturnType<typeof mock>
  callCommunityRewardsBalanceMock: ReturnType<typeof mock>
  callTokenOfOwnerByIndexMock: ReturnType<typeof mock> | undefined
  callPositionsMock: ReturnType<typeof mock> | undefined
  callEarnedSinceLastCheckpointMock: ReturnType<typeof mock> | undefined
  callStakingRewardsTotalVestedAt: ReturnType<typeof mock> | undefined
  callPositionCurrentEarnRate: ReturnType<typeof mock> | undefined
  callCommunityRewardsTokenOfOwnerMock: ReturnType<typeof mock> | undefined
  callGrantsMock: ReturnType<typeof mock> | undefined
  callClaimableRewardsMock: ReturnType<typeof mock> | undefined
  callCommunityRewardsTotalVestedAt: ReturnType<typeof mock> | undefined
  callBackerRewardsPoolTokenClaimableRewards: ReturnType<typeof mock>[] | undefined
  callBackerRewardsStakingRewardsEarnedSinceLastWithdraw: ReturnType<typeof mock>[] | undefined
  callBackerRewardsTokens: ReturnType<typeof mock>[] | undefined
  callBackerRewardsStakingRewardsClaimed: ReturnType<typeof mock>[] | undefined
}

type ContractCallMocksPlusExpectations = {
  [K in keyof ContractCallMocks]: {
    mock: ContractCallMocks[K]
    expectCalledBeforeRender: boolean
  }
}

const defaultStakingRewardsStartTime = String(defaultCurrentBlock.timestamp)
export const defaultStakingRewardsVestingLength = 31536000
const defaultStakingRewardsEndTime = String(defaultCurrentBlock.timestamp + defaultStakingRewardsVestingLength)

export async function mockUserRelatedInitializationContractCalls(
  user: User,
  stakingRewards: StakingRewards,
  gfi: GFI,
  communityRewards: CommunityRewards,
  merkleDistributor: MerkleDistributor,
  merkleDirectDistributor: MerkleDirectDistributor,
  backerMerkleDistributor: BackerMerkleDistributor,
  backerMerkleDirectDistributor: BackerMerkleDirectDistributor,
  backerRewards: BackerRewards,
  rewardsMock: RewardsMockData
): Promise<ContractCallMocksPlusExpectations> {
  user._fetchTxs = (usdc, pool, currentBlock) => {
    return Promise.resolve([
      [],
      [],
      {poolEvents: [], poolTxs: []},
      [],
      {stakedEvents: {currentBlock: rewardsMock.currentBlock, value: []}, stakingRewardsTxs: []},
      [],
      [],
      [],
      [],
      [],
    ])
  }
  user._fetchGoListStatus = (address: string, currentBlock: BlockInfo) => {
    return Promise.resolve({
      goListed: true,
      uidTypeToBalance: {
        "0": true,
        "1": true,
        "2": true,
        "3": true,
        "4": true,
      },
    })
  }

  const stakingRewardsBalance = rewardsMock?.staking
    ? rewardsMock?.staking.stakingRewardsBalance
      ? rewardsMock?.staking.stakingRewardsBalance
      : 1
    : 0

  const callGFIBalanceMock = mock({
    blockchain,
    call: {
      to: gfi.address,
      api: await getGfiAbi(),
      method: "balanceOf",
      params: [recipient],
      return: rewardsMock?.gfi?.gfiBalance || "0",
    },
  })

  const callUSDCBalanceMock = mock({
    blockchain,
    call: {
      to: "0x0000000000000000000000000000000000000002",
      api: await getErc20Abi(),
      method: "balanceOf",
      params: [recipient],
      return: "0",
    },
  })
  const callUSDCAllowanceMock = mock({
    blockchain,
    call: {
      to: "0x0000000000000000000000000000000000000002",
      api: await getErc20Abi(),
      method: "allowance",
      params: [recipient, "0x0000000000000000000000000000000000000005"],
      return: "0",
    },
  })
  const callStakingRewardsBalanceMock = mock({
    blockchain,
    call: {
      to: stakingRewards.address,
      api: await getStakingRewardsAbi(),
      method: "balanceOf",
      params: [recipient],
      return: stakingRewardsBalance,
    },
  })

  let callTokenOfOwnerByIndexMock: ReturnType<typeof mock> | undefined
  let callPositionsMock: ReturnType<typeof mock> | undefined
  let callEarnedSinceLastCheckpointMock: ReturnType<typeof mock> | undefined
  let callStakingRewardsTotalVestedAt: ReturnType<typeof mock> | undefined
  let callPositionCurrentEarnRate: ReturnType<typeof mock> | undefined
  if (rewardsMock?.staking) {
    const stakedAmount = "50000000000000000000000"

    const positionsRes = rewardsMock.staking?.positionsRes || [
      stakedAmount,
      ["0", "0", "0", "0", defaultStakingRewardsStartTime, defaultStakingRewardsEndTime],
      "1000000000000000000",
      "0",
      StakedPositionType.Fidu.toString(),
      "1000000000000000000",
      "1000000000000000000",
    ]
    if (rewardsMock.currentBlock.timestamp < parseInt(positionsRes[1][4], 10)) {
      throw new ImproperlyConfiguredMockError("Expected current timestamp not to be less than position start time.")
    }

    const earnedSince = rewardsMock.staking?.earnedSinceLastCheckpoint || "0"
    const totalVestedAt = rewardsMock.staking?.totalVestedAt || "0"
    const positionCurrentEarnRate = rewardsMock.staking?.positionCurrentEarnRate || "750000000000000"
    const stakingRewardsTokenId = rewardsMock.staking.stakingRewardsTokenId || "1"
    const stakedEvents = Array(stakingRewardsBalance)
      .fill("")
      .map(
        (_val, i: number) =>
          ({
            returnValues: {tokenId: String(i + 1), amount: stakedAmount},
            transactionHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
          } as unknown as KnownEventData<typeof STAKED_EVENT>)
      )

    UserStakingRewards.prototype.getStakedEvents = ({tokenIds}) => {
      return Promise.resolve(
        tokenIds.map(
          (tokenId) =>
            ({
              returnValues: {
                index: 0,
                account: "0x0000000000000000000000000000000000000002",
                tokenId,
                amount: stakedAmount,
              },
              transactionHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
            } as unknown as KnownEventData<typeof STAKED_EVENT>)
        )
      )
    }

    const granted = rewardsMock.staking?.granted || earnedSince

    callTokenOfOwnerByIndexMock = mock({
      blockchain,
      call: {
        to: stakingRewards.address,
        api: await getStakingRewardsAbi(),
        method: "tokenOfOwnerByIndex",
        params: [recipient, String(parseInt(stakingRewardsTokenId, 10) - 1)],
        return: stakingRewardsTokenId,
      },
    })
    callPositionsMock = mock({
      blockchain,
      call: {
        to: stakingRewards.address,
        api: await getStakingRewardsAbi(),
        method: "positions",
        params: stakingRewardsTokenId,
        return: positionsRes,
      },
    })
    callEarnedSinceLastCheckpointMock = mock({
      blockchain,
      call: {
        to: stakingRewards.address,
        api: await getStakingRewardsAbi(),
        method: "earnedSinceLastCheckpoint",
        params: stakingRewardsTokenId,
        return: earnedSince,
      },
    })

    callStakingRewardsTotalVestedAt = mock({
      blockchain,
      call: {
        to: stakingRewards.address,
        api: await getStakingRewardsAbi(),
        method: "totalVestedAt",
        params: [positionsRes[1][4], positionsRes[1][5], rewardsMock.currentBlock.timestamp, granted],
        return: totalVestedAt,
      },
    })
    user._fetchTxs = (usdc, pool, currentBlock) => {
      return Promise.resolve([
        [],
        [],
        {poolEvents: [], poolTxs: []},
        [],
        {stakedEvents: {currentBlock: rewardsMock.currentBlock, value: stakedEvents}, stakingRewardsTxs: []},
        [],
        [],
        [],
        [],
        [],
      ])
    }
    callPositionCurrentEarnRate = mock({
      blockchain,
      call: {
        to: stakingRewards.address,
        api: await getStakingRewardsAbi(),
        method: "positionCurrentEarnRate",
        params: [stakingRewardsTokenId],
        return: positionCurrentEarnRate,
      },
    })
  }

  const tokenLaunchTime = rewardsMock?.tokenLaunchTime || String(defaultCurrentBlock.timestamp)
  const callCommunityRewardsTokenLaunchTimeInSecondsMock = mock({
    blockchain,
    call: {
      to: communityRewards.address,
      api: await getCommunityRewardsAbi(),
      method: "tokenLaunchTimeInSeconds",
      return: tokenLaunchTime,
    },
  })

  const communityRewardsBalance = rewardsMock?.community ? "1" : "0"

  const callCommunityRewardsBalanceMock = mock({
    blockchain,
    call: {
      to: communityRewards.address,
      api: await getCommunityRewardsAbi(),
      method: "balanceOf",
      params: [recipient],
      return: communityRewardsBalance,
    },
  })

  let callCommunityRewardsTokenOfOwnerMock: ReturnType<typeof mock> | undefined
  let callGrantsMock: ReturnType<typeof mock> | undefined
  let callClaimableRewardsMock: ReturnType<typeof mock> | undefined
  if (rewardsMock?.community) {
    const amount = "1000000000000000000000"

    if (rewardsMock.community?.grantRes && rewardsMock.community?.grantRes[2] !== tokenLaunchTime) {
      throw new ImproperlyConfiguredMockError("Invalid grant response token launch time.")
    }
    const grant = rewardsMock.community?.grantRes || [amount, "0", tokenLaunchTime, tokenLaunchTime, "0", "1", "0"]
    const claimable = rewardsMock.community?.claimable || amount
    const acceptedGrantRes = rewardsMock.community?.acceptedGrantRes || {
      returnValues: {
        index: rewardsMock.community?.airdrop?.index || 0,
        account: recipient,
      },
      transactionHash: "0x0000000000000000000000000000000000000000000000000000000000000001",
    }
    const communityRewardsTokenId = "1"
    callCommunityRewardsTokenOfOwnerMock = mock({
      blockchain,
      call: {
        to: communityRewards.address,
        api: await getCommunityRewardsAbi(),
        method: "tokenOfOwnerByIndex",
        params: [recipient, "0"],
        return: communityRewardsTokenId,
      },
    })
    callGrantsMock = mock({
      blockchain,
      call: {
        to: communityRewards.address,
        api: await getCommunityRewardsAbi(),
        method: "grants",
        params: communityRewardsTokenId,
        return: grant,
      },
    })
    callClaimableRewardsMock = mock({
      blockchain,
      call: {
        to: communityRewards.address,
        api: await getCommunityRewardsAbi(),
        method: "claimableRewards",
        params: communityRewardsTokenId,
        return: claimable,
      },
    })
    const mockQueryEvents = <T extends KnownEventName>(
      contract:
        | MerkleDistributorContract
        | MerkleDirectDistributorContract
        | BackerMerkleDistributorContract
        | BackerMerkleDirectDistributorContract,
      eventNames: T[],
      filter: Filter | undefined,
      toBlock: BlockNumber
    ): Promise<KnownEventData<T>[]> => {
      if (contract === merkleDistributor.contract.readOnly) {
        if (eventNames.length === 1 && eventNames[0] === GRANT_ACCEPTED_EVENT) {
          if (isEqual(filter, {tokenId: communityRewardsTokenId, account: recipient})) {
            if (toBlock === 94) {
              return Promise.resolve(
                rewardsMock.community?.isFromBacker ? [] : [acceptedGrantRes as unknown as KnownEventData<T>]
              )
            } else {
              throw new Error(`Unexpected toBlock: ${toBlock}`)
            }
          } else {
            throw new Error(`Unexpected filter: ${filter}`)
          }
        } else {
          throw new Error(`Unexpected event names: ${eventNames}`)
        }
      } else if (contract === backerMerkleDistributor.contract.readOnly) {
        if (eventNames.length === 1 && eventNames[0] === GRANT_ACCEPTED_EVENT) {
          if (isEqual(filter, {tokenId: communityRewardsTokenId, account: recipient})) {
            if (toBlock === 94) {
              return Promise.resolve(
                rewardsMock.community?.isFromBacker ? [acceptedGrantRes as unknown as KnownEventData<T>] : []
              )
            } else {
              throw new Error(`Unexpected toBlock: ${toBlock}`)
            }
          } else {
            throw new Error(`Unexpected filter: ${filter}`)
          }
        } else {
          throw new Error(`Unexpected event names: ${eventNames}`)
        }
      } else if (contract === merkleDirectDistributor.contract.readOnly) {
        if (eventNames.length === 1 && eventNames[0] === GRANT_ACCEPTED_EVENT) {
          if (isEqual(filter, {index: "0"})) {
            if (toBlock === 94) {
              return Promise.resolve(
                rewardsMock.community?.isFromBacker ? [] : [acceptedGrantRes as unknown as KnownEventData<T>]
              )
            } else {
              throw new Error(`Unexpected toBlock: ${toBlock}`)
            }
          } else {
            throw new Error(`Unexpected filter: ${filter}`)
          }
        } else {
          throw new Error(`Unexpected event names: ${eventNames}`)
        }
      } else if (contract === backerMerkleDirectDistributor.contract.readOnly) {
        if (eventNames.length === 1 && eventNames[0] === GRANT_ACCEPTED_EVENT) {
          if (isEqual(filter, {index: "0"})) {
            if (toBlock === 94) {
              return Promise.resolve(
                rewardsMock.community?.isFromBacker ? [acceptedGrantRes as unknown as KnownEventData<T>] : []
              )
            } else {
              throw new Error(`Unexpected toBlock: ${toBlock}`)
            }
          } else {
            throw new Error(`Unexpected filter: ${filter}`)
          }
        } else {
          throw new Error(`Unexpected event names: ${eventNames}`)
        }
      } else {
        throw new Error("Unexpected contract.")
      }
    }
    user.goldfinchProtocol.queryEvents = mockQueryEvents
  }

  let callCommunityRewardsTotalVestedAt: ReturnType<typeof mock> | undefined
  if (rewardsMock?.notAcceptedMerkleDistributorGrant) {
    const info = rewardsMock.notAcceptedMerkleDistributorGrant
    if (rewardsMock.currentBlock.timestamp < parseInt(tokenLaunchTime, 10)) {
      throw new ImproperlyConfiguredMockError("Expected current timestamp not to be less than `tokenLaunchTime`.")
    }
    if (parseInt(info.vestingLength, 10) === 0 && info.totalVestedAt !== info.amount) {
      throw new ImproperlyConfiguredMockError("Expected grant with no vesting to be fully vested.")
    }
    callCommunityRewardsTotalVestedAt = mock({
      blockchain,
      call: {
        to: communityRewards.address,
        api: await getCommunityRewardsAbi(),
        method: "totalVestedAt",
        params: [
          tokenLaunchTime,
          String(parseInt(tokenLaunchTime, 10) + parseInt(info.vestingLength, 10)),
          info.amount,
          info.cliffLength,
          info.vestingInterval,
          info.revokedAt,
          rewardsMock.currentBlock.timestamp,
        ],
        return: info.totalVestedAt,
      },
    })
  }

  let callBackerRewardsPoolTokenClaimableRewards: ReturnType<typeof mock>[] | undefined
  let callBackerRewardsStakingRewardsEarnedSinceLastWithdraw: ReturnType<typeof mock>[] | undefined
  let callBackerRewardsTokens: ReturnType<typeof mock>[] | undefined
  let callBackerRewardsStakingRewardsClaimed: ReturnType<typeof mock>[] | undefined
  if (rewardsMock.backer) {
    callBackerRewardsPoolTokenClaimableRewards = await Promise.all(
      rewardsMock.backer.poolTokenInfos.map(async (info) =>
        mock({
          blockchain,
          call: {
            to: backerRewards.address,
            api: await getBackerRewardsAbi(),
            method: "poolTokenClaimableRewards",
            params: [info.id],
            return: info.poolTokenClaimableRewards,
          },
        })
      )
    )
    callBackerRewardsStakingRewardsEarnedSinceLastWithdraw = await Promise.all(
      rewardsMock.backer.poolTokenInfos.map(async (info) =>
        mock({
          blockchain,
          call: {
            to: backerRewards.address,
            api: await getBackerRewardsAbi(),
            method: "stakingRewardsEarnedSinceLastWithdraw",
            params: [info.id],
            return: info.stakingRewardsEarnedSinceLastWithdraw,
          },
        })
      )
    )
    callBackerRewardsTokens = await Promise.all(
      rewardsMock.backer.poolTokenInfos.map(async (info) =>
        mock({
          blockchain,
          call: {
            to: backerRewards.address,
            api: await getBackerRewardsAbi(),
            method: "tokens",
            params: [info.id],
            return: info.backerRewardsTokenInfo,
          },
        })
      )
    )
    callBackerRewardsStakingRewardsClaimed = await Promise.all(
      rewardsMock.backer.poolTokenInfos.map(async (info) =>
        mock({
          blockchain,
          call: {
            to: backerRewards.address,
            api: await getBackerRewardsAbi(),
            method: "stakingRewardsClaimed",
            params: [info.id],
            return: info.stakingRewardsClaimed,
          },
        })
      )
    )
  }

  return {
    callGFIBalanceMock: {
      mock: callGFIBalanceMock,
      expectCalledBeforeRender: true,
    },
    callUSDCBalanceMock: {
      mock: callUSDCBalanceMock,
      expectCalledBeforeRender: true,
    },
    callUSDCAllowanceMock: {
      mock: callUSDCAllowanceMock,
      expectCalledBeforeRender: true,
    },
    callStakingRewardsBalanceMock: {
      mock: callStakingRewardsBalanceMock,
      expectCalledBeforeRender: true,
    },
    callCommunityRewardsTokenLaunchTimeInSecondsMock: {
      mock: callCommunityRewardsTokenLaunchTimeInSecondsMock,
      expectCalledBeforeRender: true,
    },
    callCommunityRewardsBalanceMock: {
      mock: callCommunityRewardsBalanceMock,
      expectCalledBeforeRender: true,
    },
    callTokenOfOwnerByIndexMock: {
      mock: callTokenOfOwnerByIndexMock,
      expectCalledBeforeRender: true,
    },
    callPositionsMock: {
      mock: callPositionsMock,
      expectCalledBeforeRender: true,
    },
    callEarnedSinceLastCheckpointMock: {
      mock: callEarnedSinceLastCheckpointMock,
      expectCalledBeforeRender: true,
    },
    callStakingRewardsTotalVestedAt: {
      mock: callStakingRewardsTotalVestedAt,
      expectCalledBeforeRender: true,
    },
    callPositionCurrentEarnRate: {
      mock: callPositionCurrentEarnRate,
      expectCalledBeforeRender: true,
    },
    callCommunityRewardsTokenOfOwnerMock: {
      mock: callCommunityRewardsTokenOfOwnerMock,
      expectCalledBeforeRender: true,
    },
    callGrantsMock: {
      mock: callGrantsMock,
      expectCalledBeforeRender: true,
    },
    callClaimableRewardsMock: {
      mock: callClaimableRewardsMock,
      expectCalledBeforeRender: true,
    },
    callCommunityRewardsTotalVestedAt: {
      mock: callCommunityRewardsTotalVestedAt,
      expectCalledBeforeRender: true,
    },
    callBackerRewardsPoolTokenClaimableRewards: {
      mock: callBackerRewardsPoolTokenClaimableRewards,
      expectCalledBeforeRender: false,
    },
    callBackerRewardsStakingRewardsEarnedSinceLastWithdraw: {
      mock: callBackerRewardsStakingRewardsEarnedSinceLastWithdraw,
      expectCalledBeforeRender: false,
    },
    callBackerRewardsTokens: {
      mock: callBackerRewardsTokens,
      expectCalledBeforeRender: false,
    },
    callBackerRewardsStakingRewardsClaimed: {
      mock: callBackerRewardsStakingRewardsClaimed,
      expectCalledBeforeRender: false,
    },
  }
}

export async function mockGfiContractCalls(gfi: GFI) {
  const callTotalSupply = mock({
    blockchain,
    call: {
      to: gfi.address,
      api: await getGfiAbi(),
      method: "totalSupply",
      return: new BigNumber(1e8).multipliedBy(GFI_DECIMALS).toString(10),
    },
  })

  return {callTotalSupply}
}

export async function mockStakingRewardsContractCalls(
  stakingRewards: StakingRewards,
  currentEarnRatePerToken?: string
) {
  if (!currentEarnRatePerToken) {
    currentEarnRatePerToken = "10000000000000000000"
  }

  const DEPLOYMENTS = await getDeployments()

  let callPausedMock = mock({
    blockchain,
    call: {
      to: stakingRewards.address,
      api: await getStakingRewardsAbi(),
      method: "paused",
      return: false,
    },
  })
  let callCurrentEarnRatePerToken = mock({
    blockchain,
    call: {
      to: stakingRewards.address,
      api: await getStakingRewardsAbi(),
      method: "currentEarnRatePerToken",
      return: currentEarnRatePerToken,
    },
  })
  let callGetBaseTokenExchangeRate = mock({
    blockchain,
    call: {
      to: stakingRewards.address,
      api: await getStakingRewardsAbi(),
      method: "getBaseTokenExchangeRate",
      params: [StakedPositionType.CurveLP],
      return: new BigNumber(1e18).toString(10),
    },
  })
  let callGetEffectiveMultiplierForPositionType = mock({
    blockchain,
    call: {
      to: stakingRewards.address,
      api: await getStakingRewardsAbi(),
      method: "getEffectiveMultiplierForPositionType",
      params: [StakedPositionType.CurveLP],
      return: new BigNumber(1e18).toString(10),
    },
  })
  const callCurvePoolLPPrice = mock({
    blockchain,
    call: {
      to: DEPLOYMENTS.contracts.TestFiduUSDCCurveLP.address,
      api: DEPLOYMENTS.contracts.TestFiduUSDCCurveLP.abi,
      method: "lp_price",
      return: new BigNumber(1e18).toString(10),
    },
  })

  return {
    callPausedMock,
    callCurrentEarnRatePerToken,
    callGetBaseTokenExchangeRate,
    callGetEffectiveMultiplierForPositionType,
    callCurvePoolLPPrice,
  }
}

export async function mockCommunityRewardsContractCalls(communityRewards: CommunityRewards) {
  let callCommunityRewardsPausedMock = mock({
    blockchain,
    call: {
      to: communityRewards.address,
      api: await getCommunityRewardsAbi(),
      method: "paused",
      return: false,
    },
  })
  return {callCommunityRewardsPausedMock}
}

export async function mockMerkleDistributorContractCalls(
  merkle: MerkleDistributor,
  communityRewardsAddress: string = "0x0000000000000000000000000000000000000008"
) {
  let callCommunityRewardsMock = mock({
    blockchain,
    call: {
      to: merkle.address,
      api: await getMerkleDistributorAbi(),
      method: "communityRewards",
      return: communityRewardsAddress,
    },
  })
  return {callCommunityRewardsMock}
}

export async function mockBackerMerkleDistributorContractCalls(
  merkle: BackerMerkleDistributor,
  communityRewardsAddress: string = "0x0000000000000000000000000000000000000008"
) {
  let callCommunityRewardsMock = mock({
    blockchain,
    call: {
      to: merkle.address,
      api: await getMerkleDistributorAbi(),
      method: "communityRewards",
      return: communityRewardsAddress,
    },
  })
  return {callCommunityRewardsMock}
}

export async function mockMerkleDirectDistributorContractCalls(
  merkle: MerkleDirectDistributor,
  gfiAddress: string = "0x0000000000000000000000000000000000000006"
) {
  let callGfiMock = mock({
    blockchain,
    call: {
      to: merkle.address,
      api: await getMerkleDirectDistributorAbi(),
      method: "gfi",
      return: gfiAddress,
    },
  })
  let callPausedMock = mock({
    blockchain,
    call: {
      to: merkle.address,
      api: await getMerkleDirectDistributorAbi(),
      method: "paused",
      return: false,
    },
  })
  return {callGfiMock, callPausedMock}
}

export async function mockBackerMerkleDirectDistributorContractCalls(
  merkle: BackerMerkleDirectDistributor,
  gfiAddress: string = "0x0000000000000000000000000000000000000006"
) {
  let callGfiMock = mock({
    blockchain,
    call: {
      to: merkle.address,
      api: await getBackerMerkleDirectDistributorAbi(),
      method: "gfi",
      return: gfiAddress,
    },
  })
  let callPausedMock = mock({
    blockchain,
    call: {
      to: merkle.address,
      api: await getBackerMerkleDirectDistributorAbi(),
      method: "paused",
      return: false,
    },
  })
  return {callGfiMock, callPausedMock}
}

export async function mockBackerRewardsContractCalls(backerRewards: BackerRewards) {
  const maxInterestDollarsEligible = new BigNumber(100_000_000).multipliedBy(new BigNumber(1e18)).toString(10)
  const percentOfTotalGfi = new BigNumber(2).multipliedBy(utils.INTEREST_DECIMALS.toString(10)).toString(10)
  let callMaxInterestDollarsEligibleMock = mock({
    blockchain,
    call: {
      to: backerRewards.address,
      api: await getBackerRewardsAbi(),
      method: "maxInterestDollarsEligible",
      return: maxInterestDollarsEligible,
    },
  })
  let callTotalRewardPercentOfTotalGFIMock = mock({
    blockchain,
    call: {
      to: backerRewards.address,
      api: await getBackerRewardsAbi(),
      method: "totalRewardPercentOfTotalGFI",
      return: percentOfTotalGfi,
    },
  })
  let callPausedMock = mock({
    blockchain,
    call: {
      to: backerRewards.address,
      api: await getBackerRewardsAbi(),
      method: "paused",
      return: false,
    },
  })
  return {callMaxInterestDollarsEligibleMock, callTotalRewardPercentOfTotalGFIMock, callPausedMock}
}

export function setupMocksForMerkleDistributorAirdrop(merkleConfig: MerkleDistributorConfigMock) {
  const defaultMerkleRoot = "0x0"
  const defaultAmountTotal = "0x010f0cf064dd59200000"
  const grants = merkleConfig.distributor?.airdrop ? [merkleConfig.distributor.airdrop] : []
  const backerGrants = merkleConfig.backerDistributor?.airdrop ? [merkleConfig.backerDistributor.airdrop] : []

  jest.spyOn(utils, "getMerkleDistributorInfo").mockImplementation(() => {
    const result: MerkleDistributorInfo | undefined = {
      merkleRoot: defaultMerkleRoot,
      amountTotal: defaultAmountTotal,
      grants: grants,
    }
    return Promise.resolve(result)
  })
  jest.spyOn(utils, "getBackerMerkleDistributorInfo").mockImplementation(() => {
    const result: MerkleDistributorInfo | undefined = {
      merkleRoot: defaultMerkleRoot,
      amountTotal: defaultAmountTotal,
      grants: backerGrants,
    }
    return Promise.resolve(result)
  })
  UserMerkleDistributor.getAirdropsWithAcceptance = (
    airdropsForRecipient: MerkleDistributorGrantInfo[],
    merkleDistributor: MerkleDistributorLoaded,
    currentBlock: BlockInfo
  ) => {
    const isAccepted = merkleConfig.distributor ? merkleConfig.distributor.isAccepted : false
    const airdropsAccepted = grants.map((val) => ({grantInfo: val, isAccepted}))
    return Promise.resolve(airdropsAccepted)
  }
  UserBackerMerkleDistributor.getAirdropsWithAcceptance = (
    airdropsForRecipient: MerkleDistributorGrantInfo[],
    merkleDistributor: MerkleDistributorLoaded,
    currentBlock: BlockInfo
  ) => {
    const isAccepted = merkleConfig.backerDistributor ? merkleConfig.backerDistributor.isAccepted : false
    const airdropsAccepted = backerGrants.map((val) => ({grantInfo: val, isAccepted}))
    return Promise.resolve(airdropsAccepted)
  }
}

export function setupMocksForMerkleDirectDistributorAirdrop(
  goldfinchProtocol: GoldfinchProtocol,
  merkleConfig: MerkleDirectDistributorConfigMock
) {
  const defaultMerkleRoot = "0x0"
  const defaultAmountTotal = "0x010f0cf064dd59200000"
  const grants = merkleConfig.distributor?.airdrop ? [merkleConfig.distributor.airdrop] : []
  const backerGrants = merkleConfig.backerDistributor?.airdrop ? [merkleConfig.backerDistributor.airdrop] : []

  jest.spyOn(utils, "getMerkleDirectDistributorInfo").mockImplementation(() => {
    const result: MerkleDirectDistributorInfo | undefined = {
      merkleRoot: defaultMerkleRoot,
      amountTotal: defaultAmountTotal,
      grants: grants,
    }
    return Promise.resolve(result)
  })
  jest.spyOn(utils, "getBackerMerkleDirectDistributorInfo").mockImplementation(() => {
    const result: MerkleDirectDistributorInfo | undefined = {
      merkleRoot: defaultMerkleRoot,
      amountTotal: defaultAmountTotal,
      grants: backerGrants,
    }
    return Promise.resolve(result)
  })
  UserMerkleDirectDistributor.getAirdropsWithAcceptance = (
    airdropsForRecipient: MerkleDirectDistributorGrantInfo[],
    merkleDistributor: MerkleDirectDistributorLoaded,
    currentBlock: BlockInfo
  ) => {
    const isAccepted = merkleConfig.distributor ? merkleConfig.distributor.isAccepted : false
    const airdropsAccepted = grants.map((val) => ({grantInfo: val, isAccepted}))
    return Promise.resolve(airdropsAccepted)
  }
  UserBackerMerkleDirectDistributor.getAirdropsWithAcceptance = (
    airdropsForRecipient: MerkleDirectDistributorGrantInfo[],
    merkleDistributor: MerkleDirectDistributorLoaded,
    currentBlock: BlockInfo
  ) => {
    const isAccepted = merkleConfig.backerDistributor ? merkleConfig.backerDistributor.isAccepted : false
    const airdropsAccepted = backerGrants.map((val) => ({grantInfo: val, isAccepted}))
    return Promise.resolve(airdropsAccepted)
  }

  const airdrop = grants[0] || backerGrants[0]
  const mockQueryEvents = async <T extends KnownEventName>(
    contract: MerkleDirectDistributorContract | BackerMerkleDirectDistributorContract,
    eventNames: T[],
    filter: Filter | undefined,
    toBlock: BlockNumber
  ): Promise<KnownEventData<T>[]> => {
    if (eventNames.length === 1 && eventNames[0] === GRANT_ACCEPTED_EVENT) {
      const acceptedGrantRes =
        airdrop !== undefined
          ? {
              returnValues: {
                index: 0,
                account: "0x0000000000000000000000000000000000000002",
              },
              transactionHash: "0x0000000000000000000000000000000000000000000000000000000000000002",
            }
          : {}
      if (isEqual(filter, {index: "0"})) {
        if (toBlock === 94) {
          return Promise.resolve([acceptedGrantRes as unknown as KnownEventData<T>])
        } else {
          throw new Error(`Unexpected toBlock: ${toBlock}`)
        }
      } else {
        throw new Error(`Unexpected filter: ${JSON.stringify(filter)}`)
      }
    } else {
      throw new Error(`Unexpected event names: ${eventNames}`)
    }
  }
  goldfinchProtocol.queryEvents = mockQueryEvents
}

export function resetAirdropMocks(goldfinchProtocol: GoldfinchProtocol): void {
  setupMocksForMerkleDistributorAirdrop({
    distributor: {airdrop: undefined, isAccepted: true},
    backerDistributor: {airdrop: undefined, isAccepted: true},
  })
  setupMocksForMerkleDirectDistributorAirdrop(goldfinchProtocol, {
    distributor: {airdrop: undefined, isAccepted: true},
    backerDistributor: {airdrop: undefined, isAccepted: true},
  })
}

export function assertAllMocksAreCalled(
  mocks: Record<string, ReturnType<typeof mock> | ReturnType<typeof mock>[] | undefined>
) {
  Object.keys(mocks).forEach((key: string) => {
    const mock = mocks[key as keyof typeof mocks]
    if (mock) {
      if (Array.isArray(mock)) {
        mock.forEach((eachMock) => {
          expect(eachMock).toHaveBeenCalled()
        })
      } else {
        expect(mock).toHaveBeenCalled()
      }
    }
  })
}

export async function mockStakeFiduBannerCalls(
  toApproveAmount: string,
  allowanceAmount: string,
  notStakedFidu: string
) {
  const web3 = getWeb3()
  const DEPLOYMENTS = await getDeployments()
  const balanceMock = mock({
    blockchain,
    call: {
      to: DEPLOYMENTS.contracts.Fidu.address,
      api: DEPLOYMENTS.contracts.Fidu.abi,
      method: "balanceOf",
      params: recipient,
      return: notStakedFidu,
    },
  })
  const allowanceMock = mock({
    blockchain,
    call: {
      to: DEPLOYMENTS.contracts.Fidu.address,
      api: DEPLOYMENTS.contracts.Fidu.abi,
      method: "allowance",
      params: [recipient, DEPLOYMENTS.contracts.StakingRewards.address],
      return: allowanceAmount,
    },
  })
  web3.userWallet.eth.getGasPrice = () => {
    return Promise.resolve("100000000")
  }
  const approvalMock = mock({
    blockchain,
    transaction: {
      to: DEPLOYMENTS.contracts.Fidu.address,
      api: DEPLOYMENTS.contracts.Fidu.abi,
      method: "approve",
      params: {spender: DEPLOYMENTS.contracts.StakingRewards.address, amount: toApproveAmount},
    },
  })
  const stakeMock = mock({
    blockchain,
    transaction: {
      to: DEPLOYMENTS.contracts.StakingRewards.address,
      api: DEPLOYMENTS.contracts.StakingRewards.abi,
      method: "stake",
      params: notStakedFidu,
    },
  })
  return {
    balanceMock,
    allowanceMock,
    approvalMock,
    stakeMock,
  }
}

const DEFAULT_SHARE_PRICE = "1000456616980000000"
const DEFAULT_NUM_SHARES_NOT_STAKED = "50000000000000000000"
const DEFAULT_ALLOWANCE = "0"
const DEFAULT_WEIGHTED_AVERAGE_SHARE_PRICE = "1"

export async function mockCapitalProviderCalls(
  sharePrice?: string,
  numSharesNotStaked?: string,
  allowance?: string,
  weightedAverageSharePrice?: string
) {
  const DEPLOYMENTS = await getDeployments()
  mock({
    blockchain,
    call: {
      to: DEPLOYMENTS.contracts.SeniorPool.address,
      api: DEPLOYMENTS.contracts.SeniorPool.abi,
      method: "sharePrice",
      params: [],
      return: sharePrice || DEFAULT_SHARE_PRICE,
    },
  })
  const mockReturn = (
    pool: SeniorPoolLoaded,
    stakingRewards: StakingRewardsLoaded,
    capitalProviderAddress: string,
    capitalProviderTotalShares: BigNumber,
    currentBlock: BlockInfo
  ) => {
    return Promise.resolve(new BigNumber(weightedAverageSharePrice || DEFAULT_WEIGHTED_AVERAGE_SHARE_PRICE))
  }
  mockGetWeightedAverageSharePrice(mockReturn)
  mock({
    blockchain,
    call: {
      to: DEPLOYMENTS.contracts.Fidu.address,
      api: DEPLOYMENTS.contracts.Fidu.abi,
      method: "balanceOf",
      params: [recipient],
      return: numSharesNotStaked || DEFAULT_NUM_SHARES_NOT_STAKED,
    },
  })
  mock({
    blockchain,
    call: {
      to: DEPLOYMENTS.contracts.TestERC20.address,
      api: DEPLOYMENTS.contracts.TestERC20.abi,
      method: "allowance",
      params: [recipient, DEPLOYMENTS.contracts.SeniorPool.address],
      return: allowance || DEFAULT_ALLOWANCE,
    },
  })
}
