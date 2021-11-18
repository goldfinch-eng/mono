import "@testing-library/jest-dom"
import {mock} from "depay-web3-mock"
import BigNumber from "bignumber.js"
import {
  MerkleDistributorGrantInfo,
  MerkleDistributorInfo,
} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDistributor/types"
import {CommunityRewards, MerkleDistributor, MerkleDistributorLoaded} from "../../../ethereum/communityRewards"
import {GFI} from "../../../ethereum/gfi"
import {User, UserMerkleDistributor} from "../../../ethereum/user"
import {StakingRewards} from "../../../ethereum/pool"
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
import {BlockInfo} from "../../../utils"
import * as utils from "../../../ethereum/utils"
import * as poolModule from "../../../ethereum/pool"

export function mockCapitalProviderCalls(
  sharePrice?: string,
  numSharesNotStaked?: string,
  allowance?: string,
  weightedAverageSharePrice?: string
) {
  const defaultSharePrice = sharePrice ? sharePrice : "1000456616980000000"
  const defaultNumSharesNotStaked = numSharesNotStaked ? numSharesNotStaked : "50000000000000000000"
  const defaultAllowance = allowance ? allowance : "0"
  const defaultWeightedAverageSharePrice = weightedAverageSharePrice ? weightedAverageSharePrice : "1"

  mock({
    blockchain,
    call: {
      to: DEPLOYMENTS.contracts.SeniorPool.address,
      api: DEPLOYMENTS.contracts.SeniorPool.abi,
      method: "sharePrice",
      params: [],
      return: defaultSharePrice,
    },
  })
  jest
    .spyOn(poolModule, "getWeightedAverageSharePrice")
    .mockImplementation(
      (
        pool: poolModule.SeniorPoolLoaded,
        stakingRewards: poolModule.StakingRewardsLoaded,
        capitalProviderAddress: string,
        capitalProviderTotalShares: BigNumber,
        currentBlock: BlockInfo
      ) => {
        return Promise.resolve(new BigNumber(defaultWeightedAverageSharePrice))
      }
    )
  mock({
    blockchain,
    call: {
      to: DEPLOYMENTS.contracts.Fidu.address,
      api: DEPLOYMENTS.contracts.Fidu.abi,
      method: "balanceOf",
      params: [recipient],
      return: defaultNumSharesNotStaked,
    },
  })
  mock({
    blockchain,
    call: {
      to: DEPLOYMENTS.contracts.TestERC20.address,
      api: DEPLOYMENTS.contracts.TestERC20.abi,
      method: "allowance",
      params: [recipient, DEPLOYMENTS.contracts.SeniorPool.address],
      return: defaultAllowance,
    },
  })
}

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
  callGFIBalanceMock: any
  callUSDCBalanceMock: any
  callUSDCAllowanceMock: any
  callStakingRewardsBalanceMock: any
  callCommunityRewardsBalanceMock: any
  callTokenOfOwnerByIndexMock: any
  callPositionsMock: any
  callEarnedSinceLastCheckpointMock: any
  callTotalVestedAt: any
  callPositionCurrentEarnRate: any
  callCommunityRewardsTokenOfOwnerMock: any
  callGrantsMock: any
  callClaimableRewardsMock: any
}

export function mockUserInitializationContractCalls(
  user: User,
  stakingRewards: StakingRewards,
  gfi: GFI,
  communityRewards: CommunityRewards,
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

  let stakingRewardsBalance = 0
  if (rewardsMock?.staking) {
    stakingRewardsBalance = 1
  }

  let callGFIBalanceMock = mock({
    blockchain,
    call: {
      to: gfi.address,
      api: gfiABI,
      method: "balanceOf",
      params: [recipient],
      return: rewardsMock?.gfi?.gfiBalance || "0",
    },
  })

  let callUSDCBalanceMock = mock({
    blockchain,
    call: {
      to: "0x0000000000000000000000000000000000000002",
      api: erc20ABI,
      method: "balanceOf",
      params: [recipient],
      return: "0",
    },
  })
  let callUSDCAllowanceMock = mock({
    blockchain,
    call: {
      to: "0x0000000000000000000000000000000000000002",
      api: erc20ABI,
      method: "allowance",
      params: [recipient, "0x0000000000000000000000000000000000000005"],
      return: "0",
    },
  })
  let callStakingRewardsBalanceMock = mock({
    blockchain,
    call: {
      to: stakingRewards.address,
      api: stakingRewardsABI,
      method: "balanceOf",
      params: [recipient],
      return: stakingRewardsBalance,
    },
  })

  let callTokenOfOwnerByIndexMock: any
  let callPositionsMock: any
  let callEarnedSinceLastCheckpointMock: any
  let callTotalVestedAt: any
  let callPositionCurrentEarnRate: any
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

    callTokenOfOwnerByIndexMock = mock({
      blockchain,
      call: {
        to: stakingRewards.address,
        api: stakingRewardsABI,
        method: "tokenOfOwnerByIndex",
        params: [recipient, "0"],
        return: "1",
      },
    })
    callPositionsMock = mock({
      blockchain,
      call: {
        to: stakingRewards.address,
        api: stakingRewardsABI,
        method: "positions",
        params: "1",
        return: positionsRes,
      },
    })
    callEarnedSinceLastCheckpointMock = mock({
      blockchain,
      call: {
        to: stakingRewards.address,
        api: stakingRewardsABI,
        method: "earnedSinceLastCheckpoint",
        params: "1",
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
        params: ["1"],
        return: positionCurrentEarnRate,
      },
    })
  }

  let communityRewardsBalance = "0"
  if (rewardsMock?.community) {
    communityRewardsBalance = "1"
  }

  let callCommunityRewardsBalanceMock = mock({
    blockchain,
    call: {
      to: communityRewards.address,
      api: communityRewardsABI,
      method: "balanceOf",
      params: [recipient],
      return: communityRewardsBalance,
    },
  })

  let callCommunityRewardsTokenOfOwnerMock: any
  let callGrantsMock: any
  let callClaimableRewardsMock: any
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
    const acceptedGrantRes = rewardsMock.community?.acceptedGrantRes || [
      {
        returnValues: {
          index: rewardsMock.community?.airdrop?.index || 0,
          account: recipient,
        },
      },
    ]
    callCommunityRewardsTokenOfOwnerMock = mock({
      blockchain,
      call: {
        to: communityRewards.address,
        api: communityRewardsABI,
        method: "tokenOfOwnerByIndex",
        params: [recipient, "0"],
        return: "1",
      },
    })
    callGrantsMock = mock({
      blockchain,
      call: {
        to: communityRewards.address,
        api: communityRewardsABI,
        method: "grants",
        params: "1",
        return: grant,
      },
    })
    callClaimableRewardsMock = mock({
      blockchain,
      call: {
        to: communityRewards.address,
        api: communityRewardsABI,
        method: "claimableRewards",
        params: "1",
        return: claimable,
      },
    })
    communityRewards.goldfinchProtocol.queryEvents = (contract, event, filter, extra) => {
      return Promise.resolve(acceptedGrantRes)
    }
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
    const airdropsAccepted = grants.map((val) => ({grantInfo: airdrop, isAccepted}))
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
