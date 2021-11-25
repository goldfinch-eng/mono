import "@testing-library/jest-dom"
import {
  MerkleDistributorGrantInfo,
  MerkleDistributorInfo,
} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDistributor/types"
import {MerkleDistributor as MerkleDistributorContract} from "@goldfinch-eng/protocol/typechain/web3/MerkleDistributor"
import {MerkleDirectDistributor as MerkleDirectDistributorContract} from "@goldfinch-eng/protocol/typechain/web3/MerkleDirectDistributor"
import "@testing-library/jest-dom"
import {mock} from "depay-web3-mock"
import {BlockNumber} from "web3-core"
import {Filter} from "web3-eth-contract"
import {BigNumber} from "bignumber.js"
import {
  CommunityRewards,
  MerkleDirectDistributor,
  MerkleDirectDistributorLoaded,
  MerkleDistributor,
  MerkleDistributorLoaded,
} from "../../../ethereum/communityRewards"
import {GFI} from "../../../ethereum/gfi"
import {
  mockGetWeightedAverageSharePrice,
  SeniorPoolLoaded,
  StakingRewards,
  StakingRewardsLoaded,
} from "../../../ethereum/pool"
import {User, UserMerkleDirectDistributor, UserMerkleDistributor} from "../../../ethereum/user"
import * as utils from "../../../ethereum/utils"
import {GRANT_ACCEPTED_EVENT, KnownEventData, KnownEventName, STAKED_EVENT} from "../../../types/events"
import {BlockInfo} from "../../../utils"
import {
  blockchain,
  blockInfo,
  getCommunityRewardsAbi,
  getErc20Abi,
  getDeployments,
  getGfiAbi,
  getMerkleDistributorAbi,
  recipient,
  getStakingRewardsAbi,
  getMerkleDirectDistributorAbi,
} from "./constants"
import isEqual from "lodash/isEqual"
import web3 from "../../../web3"
import {
  MerkleDirectDistributorGrantInfo,
  MerkleDirectDistributorInfo,
} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDirectDistributor/types"

export interface RewardsMockData {
  staking?: {
    earnedSinceLastCheckpoint?: string
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
    stakingRewardsBalance?: number
    stakingRewardsTokenId?: string
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
        index: number
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
  callCommunityRewardsTokenLaunchTimeInSecondsMock: ReturnType<typeof mock>
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

export const DEFAULT_STAKING_REWARDS_START_TIME = String(blockInfo.timestamp)
export const DEFAULT_STAKING_REWARDS_END_TIME = "1672319491"

export async function mockUserInitializationContractCalls(
  user: User,
  stakingRewards: StakingRewards,
  gfi: GFI,
  communityRewards: CommunityRewards,
  merkleDistributor: MerkleDistributor,
  rewardsMock?: RewardsMockData
): Promise<ContractCallsMocks> {
  user._fetchTxs = (usdc, pool, currentBlock) => {
    return Promise.resolve([
      [],
      [],
      {poolEvents: [], poolTxs: []},
      [],
      {stakedEvents: {currentBlock: blockInfo, value: []}, stakingRewardsTxs: []},
      [],
      [],
      [],
    ])
  }
  user._fetchGolistStatus = (address: string, currentBlock: BlockInfo) => {
    return Promise.resolve({
      legacyGolisted: true,
      golisted: true,
      hasUID: true,
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
  let callTotalVestedAt: ReturnType<typeof mock> | undefined
  let callPositionCurrentEarnRate: ReturnType<typeof mock> | undefined
  if (rewardsMock?.staking) {
    const stakedAmount = "50000000000000000000000"
    const positionsRes = rewardsMock.staking?.positionsRes || [
      stakedAmount,
      ["0", "0", "0", "0", DEFAULT_STAKING_REWARDS_START_TIME, DEFAULT_STAKING_REWARDS_END_TIME],
      "1000000000000000000",
      "0",
    ]
    const earnedSince = rewardsMock.staking?.earnedSinceLastCheckpoint || "0"
    const totalVestedAt = rewardsMock.staking?.totalVestedAt || "0"
    const positionCurrentEarnRate = rewardsMock.staking?.positionCurrentEarnRate || "750000000000000"
    const currentTimestamp = rewardsMock.staking?.currentTimestamp || DEFAULT_STAKING_REWARDS_START_TIME
    const stakingRewardsTokenId = rewardsMock.staking.stakingRewardsTokenId || "1"
    const stakedEvents = Array(stakingRewardsBalance)
      .fill("")
      .map(
        (_val, i: number) =>
          ({
            returnValues: {tokenId: String(i + 1), amount: stakedAmount},
          } as unknown as KnownEventData<typeof STAKED_EVENT>)
      )
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

    callTotalVestedAt = mock({
      blockchain,
      call: {
        to: stakingRewards.address,
        api: await getStakingRewardsAbi(),
        method: "totalVestedAt",
        params: [positionsRes[1][4], positionsRes[1][5], currentTimestamp, granted],
        return: totalVestedAt,
      },
    })
    user._fetchTxs = (usdc, pool, currentBlock) => {
      return Promise.resolve([
        [],
        [],
        {poolEvents: [], poolTxs: []},
        [],
        {stakedEvents: {currentBlock: blockInfo, value: stakedEvents}, stakingRewardsTxs: []},
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

  const grantStartTime = rewardsMock?.community?.grantRes?.[2] || "1641574558"
  const callCommunityRewardsTokenLaunchTimeInSecondsMock = mock({
    blockchain,
    call: {
      to: communityRewards.address,
      api: await getCommunityRewardsAbi(),
      method: "tokenLaunchTimeInSeconds",
      return: grantStartTime,
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
    const grant = rewardsMock.community?.grantRes || [amount, "0", grantStartTime, grantStartTime, "0", "1", "0"]
    const claimable = rewardsMock.community?.claimable || amount
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
    callCommunityRewardsTokenLaunchTimeInSecondsMock,
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

export async function mockStakingRewardsContractCalls(
  stakingRewards: StakingRewards,
  currentEarnRatePerToken?: string
) {
  if (!currentEarnRatePerToken) {
    currentEarnRatePerToken = "10000000000000000000"
  }

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

  return {callPausedMock, callCurrentEarnRatePerToken}
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
  return {callGfiMock}
}

export function setupMocksForMerkleDistributorAirdrop(
  airdrop: MerkleDistributorGrantInfo | undefined,
  isAccepted: boolean
) {
  const grants = airdrop ? [airdrop] : []
  jest.spyOn(utils, "getMerkleDistributorInfo").mockImplementation(() => {
    const result: MerkleDistributorInfo | undefined = {
      merkleRoot: "0x0",
      amountTotal: "0x010f0cf064dd59200000",
      grants: grants,
    }
    return Promise.resolve(result)
  })
  UserMerkleDistributor.getAirdropsWithAcceptance = (
    airdropsForRecipient: MerkleDistributorGrantInfo[],
    merkleDistributor: MerkleDistributorLoaded,
    currentBlock: BlockInfo
  ) => {
    const airdropsAccepted = grants.map((val) => ({grantInfo: val, isAccepted}))
    return Promise.resolve(airdropsAccepted)
  }
}

export function setupMocksForMerkleDirectDistributorAirdrop(
  airdrop: MerkleDirectDistributorGrantInfo | undefined,
  isAccepted: boolean
) {
  const grants = airdrop ? [airdrop] : []
  jest.spyOn(utils, "getMerkleDirectDistributorInfo").mockImplementation(() => {
    const result: MerkleDirectDistributorInfo | undefined = {
      merkleRoot: "0x0",
      amountTotal: "0x010f0cf064dd59200000",
      grants: grants,
    }
    return Promise.resolve(result)
  })
  UserMerkleDirectDistributor.getAirdropsWithAcceptance = (
    airdropsForRecipient: MerkleDirectDistributorGrantInfo[],
    merkleDistributor: MerkleDirectDistributorLoaded,
    currentBlock: BlockInfo
  ) => {
    const airdropsAccepted = grants.map((val) => ({grantInfo: val, isAccepted}))
    return Promise.resolve(airdropsAccepted)
  }
}

export function resetAirdropMocks(): void {
  setupMocksForMerkleDistributorAirdrop(undefined, true)
  setupMocksForMerkleDirectDistributorAirdrop(undefined, true)
}

export function assertAllMocksAreCalled(mocks: Partial<ContractCallsMocks>) {
  Object.keys(mocks).forEach((key: string) => {
    const mock = mocks[key as keyof typeof mocks]
    if (mock) {
      expect(mock).toHaveBeenCalled()
    }
  })
}

export async function mockStakeFiduBannerCalls(
  toApproveAmount: string,
  allowanceAmount: string,
  notStakedFidu: string
) {
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
