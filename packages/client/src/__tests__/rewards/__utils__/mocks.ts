import {
  MerkleDistributorGrantInfo,
  MerkleDistributorInfo,
} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDistributor/types"
import {MerkleDistributor as MerkleDistributorContract} from "@goldfinch-eng/protocol/typechain/web3/MerkleDistributor"
import "@testing-library/jest-dom"
import {mock} from "depay-web3-mock"
import {BlockNumber} from "web3-core"
import {Filter} from "web3-eth-contract"
import {BigNumber} from "bignumber.js"
import {CommunityRewards, MerkleDistributor, MerkleDistributorLoaded} from "../../../ethereum/communityRewards"
import {GFI} from "../../../ethereum/gfi"
import {
  mockGetWeightedAverageSharePrice,
  SeniorPoolLoaded,
  StakingRewards,
  StakingRewardsLoaded,
} from "../../../ethereum/pool"
import {User, UserMerkleDistributor} from "../../../ethereum/user"
import * as utils from "../../../ethereum/utils"
import {GRANT_ACCEPTED_EVENT, KnownEventData, KnownEventName} from "../../../types/events"
import {BlockInfo} from "../../../utils"
import {
  blockchain,
  blockInfo,
  communityRewardsABI,
  DEPLOYMENTS,
  erc20ABI,
  gfiABI,
  merkleDistributorABI,
  recipient,
  stakingRewardsABI,
} from "./constants"
import isEqual from "lodash/isEqual"
import web3 from "../../../web3"

export interface RewardsMockData {
  staking?: {
    earnedSince?: string
    totalVestedAt?: string
    currentTimestamp?: string
    granted?: string
    positionCurrentEarnRate?: string
    positionsRes?: {
      0: string
      1: [string, string, string, string, string, string]
      2: string
      3: string
    }
  }
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
        index: Number
        account: string
      }
    }
  }
  gfi?: {
    gfiBalance?: string
  }
}

type ContractCallsMocks = {
  callGFIBalanceMock: ReturnType<typeof mock>
  callUSDCBalanceMock: ReturnType<typeof mock>
  callUSDCAllowanceMock: ReturnType<typeof mock>
  callStakingRewardsBalanceMock: ReturnType<typeof mock>
  callCommunityRewardsBalanceMock: ReturnType<typeof mock>
  callTokenOfOwnerByIndexMock: ReturnType<typeof mock> | undefined
  callPositionsMock: ReturnType<typeof mock> | undefined
  callEarnedSinceLastCheckpointMock: ReturnType<typeof mock> | undefined
  callTotalVestedAt: ReturnType<typeof mock> | undefined
  callPositionCurrentEarnRate: ReturnType<typeof mock> | undefined
  callCommunityRewardsTokenOfOwnerMock: ReturnType<typeof mock> | undefined
  callGrantsMock: ReturnType<typeof mock> | undefined
  callClaimableRewardsMock: ReturnType<typeof mock> | undefined
}

export function mockUserInitializationContractCalls(
  user: User,
  stakingRewards: StakingRewards,
  gfi: GFI,
  communityRewards: CommunityRewards,
  merkleDistributor: MerkleDistributor,
  rewardsMock?: RewardsMockData
): ContractCallsMocks {
  user.fetchTxs = (usdc, pool, currentBlock) => {
    return Promise.resolve([
      [],
      [],
      {poolEvents: [], poolTxs: []},
      [],
      {stakedEvents: {currentBlock: blockInfo, value: []}, stakingRewardsTxs: []},
      [],
      [],
    ])
  }
  user.fetchGolistStatus = (address: string, currentBlock: BlockInfo) => {
    return Promise.resolve({
      legacyGolisted: true,
      golisted: true,
      hasUID: true,
    })
  }

  const stakingRewardsBalance = rewardsMock?.staking ? 1 : 0

  const callGFIBalanceMock = mock({
    blockchain,
    call: {
      to: gfi.address,
      api: gfiABI,
      method: "balanceOf",
      params: [recipient],
      return: rewardsMock?.gfi?.gfiBalance || "0",
    },
  })

  const callUSDCBalanceMock = mock({
    blockchain,
    call: {
      to: "0x0000000000000000000000000000000000000002",
      api: erc20ABI,
      method: "balanceOf",
      params: [recipient],
      return: "0",
    },
  })
  const callUSDCAllowanceMock = mock({
    blockchain,
    call: {
      to: "0x0000000000000000000000000000000000000002",
      api: erc20ABI,
      method: "allowance",
      params: [recipient, "0x0000000000000000000000000000000000000005"],
      return: "0",
    },
  })
  const callStakingRewardsBalanceMock = mock({
    blockchain,
    call: {
      to: stakingRewards.address,
      api: stakingRewardsABI,
      method: "balanceOf",
      params: [recipient],
      return: stakingRewardsBalance,
    },
  })

  let callTokenOfOwnerByIndexMock: ReturnType<typeof mock> | undefined
  let callPositionsMock: ReturnType<typeof mock> | undefined
  let callEarnedSinceLastCheckpointMock: ReturnType<typeof mock> | undefined
  let callTotalVestedAt: ReturnType<typeof mock> | undefined
  let callPositionCurrentEarnRate: ReturnType<typeof mock> | undefined
  if (rewardsMock?.staking) {
    const positionsRes = rewardsMock.staking?.positionsRes || [
      "50000000000000000000000",
      ["0", "0", "0", "0", "1641391907", "1672927907"],
      "1000000000000000000",
      "0",
    ]
    const earnedSince = rewardsMock.staking?.earnedSince || "0"
    const totalVestedAt = rewardsMock.staking?.totalVestedAt || "0"
    const positionCurrentEarnRate = rewardsMock.staking?.positionCurrentEarnRate || "750000000000000"
    const currentTimestamp = rewardsMock.staking?.currentTimestamp || "1640783491"
    const stakedEvent = {returnValues: {tokenId: "1", amount: "50000000000000000000000"}}
    const granted = rewardsMock.staking?.granted || earnedSince
    const stakingRewardsTokenId = "1"

    callTokenOfOwnerByIndexMock = mock({
      blockchain,
      call: {
        to: stakingRewards.address,
        api: stakingRewardsABI,
        method: "tokenOfOwnerByIndex",
        params: [recipient, "0"],
        return: stakingRewardsTokenId,
      },
    })
    callPositionsMock = mock({
      blockchain,
      call: {
        to: stakingRewards.address,
        api: stakingRewardsABI,
        method: "positions",
        params: stakingRewardsTokenId,
        return: positionsRes,
      },
    })
    callEarnedSinceLastCheckpointMock = mock({
      blockchain,
      call: {
        to: stakingRewards.address,
        api: stakingRewardsABI,
        method: "earnedSinceLastCheckpoint",
        params: stakingRewardsTokenId,
        return: earnedSince,
      },
    })

    callTotalVestedAt = mock({
      blockchain,
      call: {
        to: stakingRewards.address,
        api: stakingRewardsABI,
        method: "totalVestedAt",
        params: [positionsRes[1][4], positionsRes[1][5], currentTimestamp, granted],
        return: totalVestedAt,
      },
    })
    user.fetchTxs = (usdc, pool, currentBlock) => {
      return Promise.resolve([
        [],
        [],
        {poolEvents: [], poolTxs: []},
        [],
        {stakedEvents: {currentBlock: blockInfo, value: [stakedEvent]}, stakingRewardsTxs: []},
        [],
        [],
      ])
    }
    callPositionCurrentEarnRate = mock({
      blockchain,
      call: {
        to: stakingRewards.address,
        api: stakingRewardsABI,
        method: "positionCurrentEarnRate",
        params: [stakingRewardsTokenId],
        return: positionCurrentEarnRate,
      },
    })
  }

  const communityRewardsBalance = rewardsMock?.community ? "1" : "0"

  const callCommunityRewardsBalanceMock = mock({
    blockchain,
    call: {
      to: communityRewards.address,
      api: communityRewardsABI,
      method: "balanceOf",
      params: [recipient],
      return: communityRewardsBalance,
    },
  })

  let callCommunityRewardsTokenOfOwnerMock: ReturnType<typeof mock> | undefined
  let callGrantsMock: ReturnType<typeof mock> | undefined
  let callClaimableRewardsMock: ReturnType<typeof mock> | undefined
  if (rewardsMock?.community) {
    const grant = rewardsMock.community?.grantRes || [
      "1000000000000000000000",
      "0",
      "1641574558",
      "1641574558",
      "0",
      "1",
      "0",
    ]
    const claimable = rewardsMock.community?.claimable || "1000000000000000000000"
    const acceptedGrantRes = rewardsMock.community?.acceptedGrantRes || {
      returnValues: {
        index: rewardsMock.community?.airdrop?.index || 0,
        account: recipient,
      },
    }
    const communityRewardsTokenId = "1"
    callCommunityRewardsTokenOfOwnerMock = mock({
      blockchain,
      call: {
        to: communityRewards.address,
        api: communityRewardsABI,
        method: "tokenOfOwnerByIndex",
        params: [recipient, "0"],
        return: communityRewardsTokenId,
      },
    })
    callGrantsMock = mock({
      blockchain,
      call: {
        to: communityRewards.address,
        api: communityRewardsABI,
        method: "grants",
        params: communityRewardsTokenId,
        return: grant,
      },
    })
    callClaimableRewardsMock = mock({
      blockchain,
      call: {
        to: communityRewards.address,
        api: communityRewardsABI,
        method: "claimableRewards",
        params: communityRewardsTokenId,
        return: claimable,
      },
    })
    const mockQueryEvents = <T extends KnownEventName>(
      contract: MerkleDistributorContract,
      eventNames: T[],
      filter: Filter | undefined,
      toBlock: BlockNumber
    ): Promise<KnownEventData<T>[]> => {
      if (contract === merkleDistributor.contract) {
        if (eventNames.length === 1 && eventNames[0] === GRANT_ACCEPTED_EVENT) {
          if (isEqual(filter, {tokenId: communityRewardsTokenId})) {
            if (toBlock === 94) {
              return Promise.resolve([acceptedGrantRes as unknown as KnownEventData<T>])
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

  return {
    callGFIBalanceMock,
    callUSDCBalanceMock,
    callUSDCAllowanceMock,
    callStakingRewardsBalanceMock,
    callCommunityRewardsBalanceMock,
    callTokenOfOwnerByIndexMock,
    callPositionsMock,
    callEarnedSinceLastCheckpointMock,
    callTotalVestedAt,
    callPositionCurrentEarnRate,
    callCommunityRewardsTokenOfOwnerMock,
    callGrantsMock,
    callClaimableRewardsMock,
  }
}

export function mockStakingRewardsContractCalls(stakingRewards: StakingRewards, currentEarnRatePerToken?: string) {
  if (!currentEarnRatePerToken) {
    currentEarnRatePerToken = "10000000000000000000"
  }

  let callPausedMock = mock({
    blockchain,
    call: {
      to: stakingRewards.address,
      api: stakingRewardsABI,
      method: "paused",
      return: false,
    },
  })
  let callCurrentEarnRatePerToken = mock({
    blockchain,
    call: {
      to: stakingRewards.address,
      api: stakingRewardsABI,
      method: "currentEarnRatePerToken",
      return: currentEarnRatePerToken,
    },
  })

  return {callPausedMock, callCurrentEarnRatePerToken}
}

export function mockMerkleDistributorContractCalls(
  merkle: MerkleDistributor,
  communityRewardsAddress: string = "0x0000000000000000000000000000000000000008"
) {
  let callCommunityRewardsMock = mock({
    blockchain,
    call: {
      to: merkle.address,
      api: merkleDistributorABI,
      method: "communityRewards",
      return: communityRewardsAddress,
    },
  })
  return {callCommunityRewardsMock}
}

export function setupMocksForAirdrop(airdrop: MerkleDistributorGrantInfo | undefined, isAccepted = true) {
  const grants = airdrop ? [airdrop] : []
  jest.spyOn(utils, "getMerkleDistributorInfo").mockImplementation(() => {
    const result: MerkleDistributorInfo | undefined = {
      merkleRoot: "0x0",
      amountTotal: "0x010f0cf064dd59200000",
      grants: grants,
    }
    return Promise.resolve(result)
  })
  UserMerkleDistributor.getAcceptedAirdrops = (
    airdropsForRecipient: MerkleDistributorGrantInfo[],
    merkleDistributor: MerkleDistributorLoaded,
    currentBlock: BlockInfo
  ) => {
    const airdropsAccepted = grants.map((val) => ({grantInfo: val, isAccepted}))
    return Promise.resolve(airdropsAccepted)
  }
}

export function assertAllMocksAreCalled(mocks: ContractCallsMocks) {
  Object.keys(mocks).forEach((key: string) => {
    const mock = mocks[key as keyof typeof mocks]
    if (mock) {
      expect(mock).toHaveBeenCalled()
    }
  })
}

export function mockStakeFiduBannerCalls(toApproveAmount: string, allowanceAmount: string, notStakedFidu: string) {
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
  web3.eth.getGasPrice = () => {
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

export function mockCapitalProviderCalls(
  sharePrice: string,
  numSharesNotStaked: string,
  allowance: string,
  weightedAverageSharePrice: string
) {
  mock({
    blockchain,
    call: {
      to: DEPLOYMENTS.contracts.SeniorPool.address,
      api: DEPLOYMENTS.contracts.SeniorPool.abi,
      method: "sharePrice",
      params: [],
      return: sharePrice,
    },
  })
  const mockReturn = (
    pool: SeniorPoolLoaded,
    stakingRewards: StakingRewardsLoaded,
    capitalProviderAddress: string,
    capitalProviderTotalShares: BigNumber,
    currentBlock: BlockInfo
  ) => {
    return Promise.resolve(new BigNumber(weightedAverageSharePrice))
  }
  mockGetWeightedAverageSharePrice(mockReturn)
  mock({
    blockchain,
    call: {
      to: DEPLOYMENTS.contracts.Fidu.address,
      api: DEPLOYMENTS.contracts.Fidu.abi,
      method: "balanceOf",
      params: [recipient],
      return: numSharesNotStaked,
    },
  })
  mock({
    blockchain,
    call: {
      to: DEPLOYMENTS.contracts.TestERC20.address,
      api: DEPLOYMENTS.contracts.TestERC20.abi,
      method: "allowance",
      params: [recipient, DEPLOYMENTS.contracts.SeniorPool.address],
      return: allowance,
    },
  })
}
