import "@testing-library/jest-dom"
import {mock} from "depay-web3-mock"
import {MerkleDistributorGrantInfo} from "@goldfinch-eng/protocol/blockchain_scripts/merkleDistributor/types"
import {CommunityRewards} from "../ethereum/communityRewards"
import {GFI} from "../ethereum/gfi"
import {User, UserMerkleDistributor} from "../ethereum/user"
import {StakingRewards} from "../ethereum/pool"
import {
  blockchain,
  communityRewardsABI,
  erc20ABI,
  gfiABI,
  merkleDistributorABI,
  recipient,
  stakingRewardsABI,
} from "./constants"
import * as utils from "../ethereum/utils"

interface RewardsMockData {
  hasStakingRewards: boolean
  earnedSince?: string | undefined
  totalVestedAt?: string | undefined
  currentTimestamp?: string | undefined
  granted?: string | undefined
  positionCurrentEarnRate?: string | undefined
  positionsRes?:
    | {
        0: string
        1: [string, string, string, string, string, string]
        2: string
        3: string
      }
    | undefined
  hasCommunityRewards: boolean
  airdrop?: MerkleDistributorGrantInfo
  grantRes?:
    | {
        0: string
        1: string
        2: string
        3: string
        4: string
        5: string
        6: string
      }
    | undefined
  claimable?: string
}

export function mockUserInitializationContractCalls(
  user: User,
  stakingRewards: StakingRewards,
  gfi: GFI,
  communityRewards: CommunityRewards,
  stakingRewardsMock?: RewardsMockData | undefined
) {
  user.fetchTxs = (usdc, pool, currentBlock) => {
    return [[], [], []]
  }
  user.fetchGolistStatus = (address, currentBlock) => {
    return {
      legacyGolisted: true,
      golisted: true,
    }
  }

  let stakingRewardsBalance = 0
  if (stakingRewardsMock?.hasStakingRewards) {
    stakingRewardsBalance = 1
  }

  let callGFIBalanceMock = mock({
    blockchain,
    call: {
      to: gfi.address,
      api: gfiABI,
      method: "balanceOf",
      params: [recipient],
      return: "0",
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

  let callTokenOfOwnerByIndexMock
  let callPositionsMock
  let callEarnedSinceLastCheckpointMock
  let callTotalVestedAt
  let callPositionCurrentEarnRate
  if (stakingRewardsMock?.hasStakingRewards) {
    let positionsRes = stakingRewardsMock.positionsRes || [
      "50000000000000000000000",
      ["0", "0", "0", "0", "1641391907", "1672927907"],
      "1000000000000000000",
      "0",
    ]
    let earnedSince = stakingRewardsMock.earnedSince || "0"
    let totalVestedAt = stakingRewardsMock.totalVestedAt || "0"
    let positionCurrentEarnRate = stakingRewardsMock.positionCurrentEarnRate || "750000000000000"
    let currentTimestamp = stakingRewardsMock.currentTimestamp || "1640783491"
    let stakedEvent = {returnValues: {amount: "50000000000000000000000"}}
    let granted = stakingRewardsMock.granted || earnedSince

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
        params: ["1"],
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
    stakingRewards.getStakedEvent = (address, tokenId, number) => {
      return stakedEvent
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
  if (stakingRewardsMock?.hasCommunityRewards) {
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

  let callCommunityRewardsTokenOfOwnerMock
  let callGrantsMock
  let callClaimableRewardsMock
  if (stakingRewardsMock?.hasCommunityRewards) {
    const grant = stakingRewardsMock.grantRes || [
      "1000000000000000000000",
      "0",
      "1641574558",
      "1641574558",
      "0",
      "1",
      "0",
    ]
    const claimable = stakingRewardsMock.claimable || "1000000000000000000000"
    const acceptedGrantRes = [
      {
        returnValues: {
          index: stakingRewardsMock.airdrop?.index || 0,
          account: recipient,
          reason: stakingRewardsMock.airdrop?.reason,
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
    stakingRewards.goldfinchProtocol.queryEvent = (contract, event, filter, extra) => {
      return acceptedGrantRes
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

export function mockStakingRewardsContractCalls(stakingRewards, currentEarnRatePerToken?: string | undefined) {
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
  merkle,
  communityRewardsAddress = "0x0000000000000000000000000000000000000008"
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

export function setupMocksForAcceptedAirdrop(airdrop, isAccepted = true) {
  const grants = airdrop ? [airdrop] : []
  jest.spyOn(utils, "getMerkleDistributorInfo").mockImplementation(() => {
    return {
      merkleRoot: "0x0",
      amount: "0x010f0cf064dd59200000",
      grants: grants,
    }
  })
  UserMerkleDistributor.getAirdropsWithAcceptance = (airdropsForRecipient, merkleDistributor, currentBlock) => {
    return grants
      ? [
          {
            grantInfo: airdrop,
            isAccepted: isAccepted,
          },
        ]
      : []
  }
}

export function assertAllMocksAreCalled(mocks) {
  const {
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
  } = mocks

  if (callGFIBalanceMock) {
    expect(callGFIBalanceMock).toHaveBeenCalled()
  }
  if (callUSDCBalanceMock) {
    expect(callUSDCBalanceMock).toHaveBeenCalled()
  }
  if (callUSDCAllowanceMock) {
    expect(callUSDCAllowanceMock).toHaveBeenCalled()
  }
  if (callStakingRewardsBalanceMock) {
    expect(callStakingRewardsBalanceMock).toHaveBeenCalled()
  }
  if (callCommunityRewardsBalanceMock) {
    expect(callCommunityRewardsBalanceMock).toHaveBeenCalled()
  }
  if (callTokenOfOwnerByIndexMock) {
    expect(callTokenOfOwnerByIndexMock).toHaveBeenCalled()
  }
  if (callPositionsMock) {
    expect(callPositionsMock).toHaveBeenCalled()
  }
  if (callEarnedSinceLastCheckpointMock) {
    expect(callEarnedSinceLastCheckpointMock).toHaveBeenCalled()
  }
  if (callTotalVestedAt) {
    expect(callTotalVestedAt).toHaveBeenCalled()
  }
  if (callPositionCurrentEarnRate) {
    expect(callPositionCurrentEarnRate).toHaveBeenCalled()
  }
  if (callCommunityRewardsTokenOfOwnerMock) {
    expect(callCommunityRewardsTokenOfOwnerMock).toHaveBeenCalled()
  }
  if (callGrantsMock) {
    expect(callGrantsMock).toHaveBeenCalled()
  }
  if (callClaimableRewardsMock) {
    expect(callClaimableRewardsMock).toHaveBeenCalled()
  }
}
