import "@testing-library/jest-dom"
import {MerkleDistributorGrantInfo} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDistributor/types"
import {MerkleDistributor, CommunityRewards, MerkleDirectDistributor} from "../../../ethereum/communityRewards"
import {GFI} from "../../../ethereum/gfi"
import {User} from "../../../ethereum/user"
import {SeniorPoolLoaded, StakingRewards} from "../../../ethereum/pool"
import {blockInfo, network, recipient} from "./constants"
import {assertWithLoadedInfo} from "../../../types/loadable"
import {
  mockStakingRewardsContractCalls,
  mockMerkleDistributorContractCalls,
  mockUserInitializationContractCalls,
  setupMocksForMerkleDistributorAirdrop,
  assertAllMocksAreCalled,
  DEFAULT_STAKING_REWARDS_START_TIME,
  DEFAULT_STAKING_REWARDS_END_TIME,
  RewardsMockData,
  mockMerkleDirectDistributorContractCalls,
  setupMocksForMerkleDirectDistributorAirdrop,
} from "./mocks"
import {GoldfinchProtocol} from "../../../ethereum/GoldfinchProtocol"
import {CreditDesk} from "@goldfinch-eng/protocol/typechain/web3/CreditDesk"
import omit from "lodash/omit"
import {MerkleDirectDistributorGrantInfo} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDirectDistributor/types"

export async function setupNewStakingReward(goldfinchProtocol: GoldfinchProtocol, seniorPool: SeniorPoolLoaded) {
  const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor} = await getDefaultClasses(
    goldfinchProtocol
  )
  const user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
  const mocks = await mockUserInitializationContractCalls(
    user,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    {
      staking: {},
    }
  )
  await user.initialize(
    seniorPool,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    merkleDirectDistributor,
    blockInfo
  )

  assertWithLoadedInfo(user)
  assertAllMocksAreCalled(mocks)
  return {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user}
}

export async function setupClaimableStakingReward(goldfinchProtocol, seniorPool) {
  const updatedBlockInfo = {...blockInfo}
  updatedBlockInfo.timestamp = 1641564707

  const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor} = await getDefaultClasses(
    goldfinchProtocol
  )
  const user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
  const mocks = await mockUserInitializationContractCalls(
    user,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    {
      staking: {
        currentTimestamp: String(updatedBlockInfo.timestamp),
        earnedSinceLastCheckpoint: "129600000000000000000",
        totalVestedAt: "710136986301369863",
      },
    }
  )
  await user.initialize(
    seniorPool,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    merkleDirectDistributor,
    updatedBlockInfo
  )

  assertWithLoadedInfo(user)
  assertAllMocksAreCalled(mocks)

  return {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user}
}

export async function setupClaimableCommunityReward(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded
) {
  const airdrop: MerkleDistributorGrantInfo = {
    index: 0,
    account: recipient,
    reason: "flight_academy",
    grant: {
      amount: "0x3635c9adc5dea00000",
      vestingLength: "0x00",
      cliffLength: "0x00",
      vestingInterval: "0x01",
    },
    proof: ["0x00", "0x00", "0x00"],
  }
  setupMocksForMerkleDistributorAirdrop(airdrop, true)

  const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor} = await getDefaultClasses(
    goldfinchProtocol
  )
  const user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
  const mocks = await mockUserInitializationContractCalls(
    user,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    {
      community: {
        airdrop: airdrop,
      },
    }
  )
  await user.initialize(
    seniorPool,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    merkleDirectDistributor,
    blockInfo
  )

  assertWithLoadedInfo(user)
  assertAllMocksAreCalled(mocks)

  return {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user}
}

export async function setupMerkleDistributorAirdrop(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded
) {
  const airdrop: MerkleDistributorGrantInfo = {
    index: 0,
    account: recipient,
    reason: "flight_academy",
    grant: {
      amount: "0x3635c9adc5dea00000",
      vestingLength: "0x00",
      cliffLength: "0x00",
      vestingInterval: "0x01",
    },
    proof: ["0x00", "0x00", "0x00"],
  }
  setupMocksForMerkleDistributorAirdrop(airdrop, false)
  const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor} = await getDefaultClasses(
    goldfinchProtocol
  )
  const user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
  const mocks = await mockUserInitializationContractCalls(
    user,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    {}
  )
  await user.initialize(
    seniorPool,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    merkleDirectDistributor,
    blockInfo
  )

  assertWithLoadedInfo(user)
  assertAllMocksAreCalled(mocks)

  return {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user}
}

export async function setupVestingCommunityReward(goldfinchProtocol: GoldfinchProtocol, seniorPool: SeniorPoolLoaded) {
  const airdrop: MerkleDistributorGrantInfo = {
    index: 2,
    account: recipient,
    reason: "goldfinch_investment",
    grant: {
      amount: "0x3635c9adc5dea00000",
      vestingLength: "0x1770",
      cliffLength: "0x00",
      vestingInterval: "0x012c",
    },
    proof: ["0x00", "0x00", "0x00"],
  }
  setupMocksForMerkleDistributorAirdrop(airdrop, true)

  const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor} = await getDefaultClasses(
    goldfinchProtocol
  )
  const user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
  const mocks = await mockUserInitializationContractCalls(
    user,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    {
      community: {
        airdrop: airdrop,
        grantRes: ["1000000000000000000000", "0", "1641576557", "1641582557", "0", "300", "0"],
        claimable: "0",
      },
    }
  )
  await user.initialize(
    seniorPool,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    merkleDirectDistributor,
    blockInfo
  )

  assertWithLoadedInfo(user)
  assertAllMocksAreCalled(mocks)

  return {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user}
}

export async function setupPartiallyClaimedCommunityReward(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded,
  gfiBalance?: string
) {
  const updatedBlockInfo = {...blockInfo}
  updatedBlockInfo.timestamp = 1643386120

  const airdrop: MerkleDistributorGrantInfo = {
    index: 2,
    account: recipient,
    reason: "goldfinch_investment",
    grant: {
      amount: "0x3635c9adc5dea00000",
      vestingLength: "0x01e13380",
      cliffLength: "0x00",
      vestingInterval: "0x01",
    },
    proof: ["0x00", "0x00", "0x00"],
  }
  setupMocksForMerkleDistributorAirdrop(airdrop, true)

  const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor} = await getDefaultClasses(
    goldfinchProtocol
  )
  const user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
  const mocks = await mockUserInitializationContractCalls(
    user,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    {
      community: {
        airdrop: airdrop,
        grantRes: ["1000000000000000000000", "5480149670218163368", "1642867698", "1673112557", "0", "1", "0"],
        claimable: "10958904109589041096",
      },
      gfi: {gfiBalance},
    }
  )
  await user.initialize(
    seniorPool,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    merkleDirectDistributor,
    blockInfo
  )

  assertWithLoadedInfo(user)
  assertAllMocksAreCalled(mocks)

  return {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user}
}

export async function setupCommunityRewardAndStakingReward(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded
) {
  const updatedBlockInfo = {...blockInfo}
  updatedBlockInfo.timestamp = 1641564707

  const airdrop: MerkleDistributorGrantInfo = {
    index: 0,
    account: recipient,
    reason: "flight_academy",
    grant: {
      amount: "0x3635c9adc5dea00000",
      vestingLength: "0x00",
      cliffLength: "0x00",
      vestingInterval: "0x01",
    },
    proof: ["0x00", "0x00", "0x00"],
  }
  setupMocksForMerkleDistributorAirdrop(airdrop, true)

  const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor} = await getDefaultClasses(
    goldfinchProtocol
  )
  const user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
  const mocks = await mockUserInitializationContractCalls(
    user,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    {
      staking: {
        currentTimestamp: String(updatedBlockInfo.timestamp),
        earnedSinceLastCheckpoint: "129600000000000000000",
        totalVestedAt: "710136986301369863",
      },
      community: {
        airdrop: airdrop,
      },
    }
  )
  await user.initialize(
    seniorPool,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    merkleDirectDistributor,
    updatedBlockInfo
  )

  assertWithLoadedInfo(user)
  assertAllMocksAreCalled(mocks)

  return {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user}
}

const merkleDirectDistributorAirdropAmountHex = "0x878678326eac900000"
const merkleDirectDistributorAirdropAmount = "2500000000000000000000"
const merkleDirectDistributorAirdrop: MerkleDirectDistributorGrantInfo = {
  index: 0,
  account: recipient,
  reason: "flight_academy",
  grant: {
    amount: merkleDirectDistributorAirdropAmountHex,
  },
  proof: ["0x00", "0x00", "0x00"],
}

export async function setupDirectReward(goldfinchProtocol: GoldfinchProtocol, seniorPool: SeniorPoolLoaded) {
  const updatedBlockInfo = {...blockInfo}
  updatedBlockInfo.timestamp = 1641564707

  setupMocksForMerkleDirectDistributorAirdrop(merkleDirectDistributorAirdrop, true)

  const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor} = await getDefaultClasses(
    goldfinchProtocol
  )
  const user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
  const mocks = await mockUserInitializationContractCalls(
    user,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    {
      gfi: {
        gfiBalance: merkleDirectDistributorAirdropAmount,
      },
    }
  )
  await user.initialize(
    seniorPool,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    merkleDirectDistributor,
    updatedBlockInfo
  )

  assertWithLoadedInfo(user)
  assertAllMocksAreCalled(mocks)

  return {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user}
}

export async function setupDirectRewardAndStakingReward(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded
) {
  const updatedBlockInfo = {...blockInfo}
  updatedBlockInfo.timestamp = 1641564707

  setupMocksForMerkleDirectDistributorAirdrop(merkleDirectDistributorAirdrop, true)

  const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor} = await getDefaultClasses(
    goldfinchProtocol
  )
  const user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
  const mocks = await mockUserInitializationContractCalls(
    user,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    {
      staking: {
        currentTimestamp: String(updatedBlockInfo.timestamp),
        earnedSinceLastCheckpoint: "129600000000000000000",
        totalVestedAt: "710136986301369863",
      },
      gfi: {
        gfiBalance: merkleDirectDistributorAirdropAmount,
      },
    }
  )
  await user.initialize(
    seniorPool,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    merkleDirectDistributor,
    updatedBlockInfo
  )

  assertWithLoadedInfo(user)
  assertAllMocksAreCalled(mocks)

  return {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user}
}

export async function setupCommunityRewardAndDirectRewardAndStakingReward(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded
) {
  const updatedBlockInfo = {...blockInfo}
  updatedBlockInfo.timestamp = 1641564707

  const merkleDistributorAirdrop: MerkleDistributorGrantInfo = {
    index: 0,
    account: recipient,
    reason: "goldfinch_investment",
    grant: {
      amount: "0x3635c9adc5dea00000",
      vestingLength: "0x00",
      cliffLength: "0x00",
      vestingInterval: "0x01",
    },
    proof: ["0x00", "0x00", "0x00"],
  }
  setupMocksForMerkleDistributorAirdrop(merkleDistributorAirdrop, true)

  setupMocksForMerkleDirectDistributorAirdrop(merkleDirectDistributorAirdrop, true)

  const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor} = await getDefaultClasses(
    goldfinchProtocol
  )
  const user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
  const mocks = await mockUserInitializationContractCalls(
    user,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    {
      staking: {
        currentTimestamp: String(updatedBlockInfo.timestamp),
        earnedSinceLastCheckpoint: "129600000000000000000",
        totalVestedAt: "710136986301369863",
      },
      community: {
        airdrop: merkleDistributorAirdrop,
      },
      gfi: {
        gfiBalance: merkleDirectDistributorAirdropAmount,
      },
    }
  )
  await user.initialize(
    seniorPool,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    merkleDirectDistributor,
    updatedBlockInfo
  )

  assertWithLoadedInfo(user)
  assertAllMocksAreCalled(mocks)

  return {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user}
}

export async function setupPartiallyClaimedStakingReward(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded,
  gfiBalance?: string
) {
  const updatedBlockInfo = {...blockInfo}
  updatedBlockInfo.timestamp = 1641750579

  const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor} = await getDefaultClasses(
    goldfinchProtocol
  )
  const user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
  const mocks = await mockUserInitializationContractCalls(
    user,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    {
      staking: {
        currentTimestamp: String(updatedBlockInfo.timestamp),
        earnedSinceLastCheckpoint: "129600000000000000000",
        totalVestedAt: "3059493996955859969",
        granted: "269004000000000000000",
        positionsRes: [
          "50000000000000000000000",
          [
            "138582358057838660579",
            "821641942161339421",
            "0",
            "821641942161339421",
            DEFAULT_STAKING_REWARDS_START_TIME,
            DEFAULT_STAKING_REWARDS_END_TIME,
          ],
          "1000000000000000000",
          "0",
        ],
      },
      gfi: {gfiBalance},
    }
  )
  await user.initialize(
    seniorPool,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    merkleDirectDistributor,
    updatedBlockInfo
  )

  assertWithLoadedInfo(user)
  assertAllMocksAreCalled(mocks)
  return {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user}
}

export async function setupMultiplePartiallyClaimedStakingRewards(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded,
  gfiBalance?: string
) {
  const updatedBlockInfo = {...blockInfo}
  updatedBlockInfo.timestamp = 1641750579

  const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor} = await getDefaultClasses(
    goldfinchProtocol
  )
  const user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
  const amount = "5000000000000000000000"
  const leverageMultiplier = "1000000000000000000"
  const lockedUntil = "0"
  const totalUnvested = "138582358057838660579"
  const totalVested = "821641942161339421"
  const totalPreviouslyVested = "0"
  const totalClaimed = "821641942161339421"
  const mockedPositionRes1: NonNullable<NonNullable<RewardsMockData["staking"]>["positionsRes"]> = [
    amount,
    [
      totalUnvested,
      totalVested,
      totalPreviouslyVested,
      totalClaimed,
      DEFAULT_STAKING_REWARDS_START_TIME,
      DEFAULT_STAKING_REWARDS_END_TIME,
    ],
    leverageMultiplier,
    lockedUntil,
  ]
  const mockedStaking1: NonNullable<RewardsMockData["staking"]> = {
    currentTimestamp: String(updatedBlockInfo.timestamp),
    earnedSinceLastCheckpoint: "129600000000000000000",
    totalVestedAt: "3059493996955859969",
    granted: "269004000000000000000",
    positionsRes: mockedPositionRes1,
    stakingRewardsBalance: 2,
    stakingRewardsTokenId: "1",
  }
  const mockedPositionRes2: NonNullable<NonNullable<RewardsMockData["staking"]>["positionsRes"]> = [
    amount,
    [
      totalUnvested,
      totalVested,
      totalPreviouslyVested,
      totalClaimed,
      DEFAULT_STAKING_REWARDS_END_TIME,
      String(
        parseInt(DEFAULT_STAKING_REWARDS_END_TIME, 10) +
          (parseInt(DEFAULT_STAKING_REWARDS_END_TIME, 10) - parseInt(DEFAULT_STAKING_REWARDS_START_TIME, 10))
      ),
    ],
    leverageMultiplier,
    lockedUntil,
  ]
  const mockedStaking2 = {
    ...mockedStaking1,
    positionsRes: mockedPositionRes2,
    stakingRewardsTokenId: "2",
  }
  const mocks1 = await mockUserInitializationContractCalls(
    user,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    {
      staking: mockedStaking1,
    }
  )
  const mocks2 = await mockUserInitializationContractCalls(
    user,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    {
      staking: mockedStaking2,
      gfi: {gfiBalance},
    }
  )
  await user.initialize(
    seniorPool,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    merkleDirectDistributor,
    updatedBlockInfo
  )

  assertWithLoadedInfo(user)
  assertAllMocksAreCalled(
    omit(mocks1, [
      "callGFIBalanceMock",
      "callUSDCBalanceMock",
      "callUSDCAllowanceMock",
      "callStakingRewardsBalanceMock",
      "callCommunityRewardsBalanceMock",
      "callCommunityRewardsTokenOfOwnerMock",
      "callGrantsMock",
      "callClaimableRewardsMock",
    ])
  )
  assertAllMocksAreCalled(mocks2)
  return {gfi, stakingRewards, communityRewards, merkleDistributor, user}
}

export async function getDefaultClasses(goldfinchProtocol: GoldfinchProtocol) {
  const gfi = new GFI(goldfinchProtocol)
  await gfi.initialize(blockInfo)
  const stakingRewards = new StakingRewards(goldfinchProtocol)
  await mockStakingRewardsContractCalls(stakingRewards)
  await stakingRewards.initialize(blockInfo)

  const communityRewards = new CommunityRewards(goldfinchProtocol)
  await communityRewards.initialize(blockInfo)

  const merkleDistributor = new MerkleDistributor(goldfinchProtocol)
  await mockMerkleDistributorContractCalls(merkleDistributor)
  await merkleDistributor.initialize(blockInfo)

  const merkleDirectDistributor = new MerkleDirectDistributor(goldfinchProtocol)
  await mockMerkleDirectDistributorContractCalls(merkleDirectDistributor)
  await merkleDirectDistributor.initialize(blockInfo)

  assertWithLoadedInfo(gfi)
  assertWithLoadedInfo(stakingRewards)
  assertWithLoadedInfo(communityRewards)
  assertWithLoadedInfo(merkleDistributor)
  assertWithLoadedInfo(merkleDirectDistributor)

  return {
    gfi,
    stakingRewards,
    communityRewards,
    merkleDistributor,
    merkleDirectDistributor,
  }
}

export async function setupMerkleDirectDistributorAirdrop(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded
) {
  setupMocksForMerkleDirectDistributorAirdrop(merkleDirectDistributorAirdrop, false)
  const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor} = await getDefaultClasses(
    goldfinchProtocol
  )
  const user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
  const mocks = await mockUserInitializationContractCalls(
    user,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    {}
  )
  await user.initialize(
    seniorPool,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    merkleDirectDistributor,
    blockInfo
  )

  assertWithLoadedInfo(user)
  assertAllMocksAreCalled(mocks)

  return {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user}
}

export async function setupAcceptedDirectReward(goldfinchProtocol: GoldfinchProtocol, seniorPool: SeniorPoolLoaded) {
  setupMocksForMerkleDirectDistributorAirdrop(merkleDirectDistributorAirdrop, true)

  const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor} = await getDefaultClasses(
    goldfinchProtocol
  )
  const user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
  const mocks = await mockUserInitializationContractCalls(
    user,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    {
      gfi: {
        gfiBalance: merkleDirectDistributorAirdropAmount,
      },
    }
  )
  await user.initialize(
    seniorPool,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    merkleDirectDistributor,
    blockInfo
  )

  assertWithLoadedInfo(user)
  assertAllMocksAreCalled(mocks)

  return {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user}
}
