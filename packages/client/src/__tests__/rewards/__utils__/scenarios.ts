import "@testing-library/jest-dom"
import {MerkleDistributorGrantInfo} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDistributor/types"
import {MerkleDistributor, CommunityRewards, MerkleDirectDistributor} from "../../../ethereum/communityRewards"
import {GFI} from "../../../ethereum/gfi"
import {User} from "../../../ethereum/user"
import {SeniorPoolLoaded, StakingRewards} from "../../../ethereum/pool"
import {defaultCurrentBlock, network, recipient} from "./constants"
import {assertWithLoadedInfo} from "../../../types/loadable"
import {
  mockStakingRewardsContractCalls,
  mockMerkleDistributorContractCalls,
  mockUserInitializationContractCalls,
  setupMocksForMerkleDistributorAirdrop,
  assertAllMocksAreCalled,
  RewardsMockData,
  mockMerkleDirectDistributorContractCalls,
  setupMocksForMerkleDirectDistributorAirdrop,
  defaultStakingRewardsVestingLength,
} from "./mocks"
import {GoldfinchProtocol} from "../../../ethereum/GoldfinchProtocol"
import {CreditDesk} from "@goldfinch-eng/protocol/typechain/web3/CreditDesk"
import omit from "lodash/omit"
import {MerkleDirectDistributorGrantInfo} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDirectDistributor/types"
import BigNumber from "bignumber.js"
import {BlockInfo} from "../../../utils"

export async function setupNewStakingReward(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded,
  currentBlock: BlockInfo
) {
  const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor} = await getDefaultClasses(
    goldfinchProtocol,
    currentBlock
  )
  const user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
  const mocks = await mockUserInitializationContractCalls(
    user,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    {
      currentBlock,
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
    currentBlock
  )

  assertWithLoadedInfo(user)
  assertAllMocksAreCalled(mocks)
  return {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user}
}

export async function setupClaimableStakingReward(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded,
  currentBlock: BlockInfo
) {
  const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor} = await getDefaultClasses(
    goldfinchProtocol,
    currentBlock
  )
  const user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
  const mocks = await mockUserInitializationContractCalls(
    user,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    {
      currentBlock,
      staking: {
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
    currentBlock
  )

  assertWithLoadedInfo(user)
  assertAllMocksAreCalled(mocks)

  return {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user}
}

const merkleDistributorAirdropNoVesting: MerkleDistributorGrantInfo = {
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

export async function setupClaimableCommunityReward(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded,
  currentBlock: BlockInfo
) {
  setupMocksForMerkleDistributorAirdrop(merkleDistributorAirdropNoVesting, true)

  const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor} = await getDefaultClasses(
    goldfinchProtocol,
    currentBlock
  )
  const user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
  const mocks = await mockUserInitializationContractCalls(
    user,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    {
      currentBlock,
      community: {
        airdrop: merkleDistributorAirdropNoVesting,
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
    currentBlock
  )

  assertWithLoadedInfo(user)
  assertAllMocksAreCalled(mocks)

  return {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user}
}

export async function setupMerkleDistributorAirdropNoVesting(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded,
  currentBlock: BlockInfo
) {
  setupMocksForMerkleDistributorAirdrop(merkleDistributorAirdropNoVesting, false)
  const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor} = await getDefaultClasses(
    goldfinchProtocol,
    currentBlock
  )
  const user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
  const mocks = await mockUserInitializationContractCalls(
    user,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    {
      currentBlock,
      notAcceptedMerkleDistributorGrant: {
        amount: new BigNumber(merkleDistributorAirdropNoVesting.grant.amount).toString(10),
        vestingLength: new BigNumber(merkleDistributorAirdropNoVesting.grant.vestingLength).toString(10),
        cliffLength: new BigNumber(merkleDistributorAirdropNoVesting.grant.cliffLength).toString(10),
        vestingInterval: new BigNumber(merkleDistributorAirdropNoVesting.grant.vestingInterval).toString(10),
        revokedAt: "0",
        totalVestedAt: new BigNumber(merkleDistributorAirdropNoVesting.grant.amount).toString(10),
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
    currentBlock
  )

  assertWithLoadedInfo(user)
  assertAllMocksAreCalled(mocks)

  return {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user}
}

export async function setupVestingCommunityReward(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded,
  currentBlock: BlockInfo
) {
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
    goldfinchProtocol,
    currentBlock
  )
  const user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
  const mocks = await mockUserInitializationContractCalls(
    user,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    {
      currentBlock,
      community: {
        airdrop: airdrop,
        grantRes: [
          "1000000000000000000000",
          "0",
          String(currentBlock.timestamp),
          String(currentBlock.timestamp + 6000),
          "0",
          "300",
          "0",
        ],
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
    currentBlock
  )

  assertWithLoadedInfo(user)
  assertAllMocksAreCalled(mocks)

  return {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user}
}

export async function setupPartiallyClaimedCommunityReward(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded,
  gfiBalance: string | undefined,
  currentBlock: BlockInfo
) {
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
    goldfinchProtocol,
    currentBlock
  )
  const user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
  const mocks = await mockUserInitializationContractCalls(
    user,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    {
      currentBlock,
      community: {
        airdrop: airdrop,
        grantRes: [
          "1000000000000000000000",
          "5480149670218163368",
          String(currentBlock.timestamp - 518422),
          String(currentBlock.timestamp + 29726437),
          "0",
          "1",
          "0",
        ],
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
    currentBlock
  )

  assertWithLoadedInfo(user)
  assertAllMocksAreCalled(mocks)

  return {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user}
}

export async function setupCommunityRewardAndStakingReward(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded,
  currentBlock: BlockInfo
) {
  setupMocksForMerkleDistributorAirdrop(merkleDistributorAirdropNoVesting, true)

  const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor} = await getDefaultClasses(
    goldfinchProtocol,
    currentBlock
  )
  const user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
  const mocks = await mockUserInitializationContractCalls(
    user,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    {
      currentBlock,
      staking: {
        earnedSinceLastCheckpoint: "129600000000000000000",
        totalVestedAt: "710136986301369863",
      },
      community: {
        airdrop: merkleDistributorAirdropNoVesting,
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
    currentBlock
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

export async function setupDirectReward(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded,
  currentBlock: BlockInfo
) {
  setupMocksForMerkleDirectDistributorAirdrop(merkleDirectDistributorAirdrop, true)

  const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor} = await getDefaultClasses(
    goldfinchProtocol,
    currentBlock
  )
  const user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
  const mocks = await mockUserInitializationContractCalls(
    user,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    {
      currentBlock,
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
    currentBlock
  )

  assertWithLoadedInfo(user)
  assertAllMocksAreCalled(mocks)

  return {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user}
}

export async function setupDirectRewardAndStakingReward(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded,
  currentBlock: BlockInfo
) {
  setupMocksForMerkleDirectDistributorAirdrop(merkleDirectDistributorAirdrop, true)

  const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor} = await getDefaultClasses(
    goldfinchProtocol,
    currentBlock
  )
  const user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
  const mocks = await mockUserInitializationContractCalls(
    user,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    {
      currentBlock,
      staking: {
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
    currentBlock
  )

  assertWithLoadedInfo(user)
  assertAllMocksAreCalled(mocks)

  return {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user}
}

export async function setupCommunityRewardAndDirectRewardAndStakingReward(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded,
  currentBlock: BlockInfo
) {
  setupMocksForMerkleDistributorAirdrop(merkleDistributorAirdropNoVesting, true)

  setupMocksForMerkleDirectDistributorAirdrop(merkleDirectDistributorAirdrop, true)

  const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor} = await getDefaultClasses(
    goldfinchProtocol,
    currentBlock
  )
  const user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
  const mocks = await mockUserInitializationContractCalls(
    user,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    {
      currentBlock,
      staking: {
        earnedSinceLastCheckpoint: "129600000000000000000",
        totalVestedAt: "710136986301369863",
      },
      community: {
        airdrop: merkleDistributorAirdropNoVesting,
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
    currentBlock
  )

  assertWithLoadedInfo(user)
  assertAllMocksAreCalled(mocks)

  return {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user}
}

export async function setupPartiallyClaimedStakingReward(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded,
  gfiBalance: string | undefined,
  currentBlock: BlockInfo
) {
  const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor} = await getDefaultClasses(
    goldfinchProtocol,
    currentBlock
  )
  const user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
  const mocks = await mockUserInitializationContractCalls(
    user,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    {
      currentBlock,
      staking: {
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
            String(currentBlock.timestamp - defaultStakingRewardsVestingLength),
            String(currentBlock.timestamp + defaultStakingRewardsVestingLength),
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
    currentBlock
  )

  assertWithLoadedInfo(user)
  assertAllMocksAreCalled(mocks)
  return {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user}
}

export async function setupMultiplePartiallyClaimedStakingRewards(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded,
  gfiBalance: string | undefined,
  currentBlock: BlockInfo
) {
  const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor} = await getDefaultClasses(
    goldfinchProtocol,
    currentBlock
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
      String(currentBlock.timestamp - defaultStakingRewardsVestingLength),
      String(currentBlock.timestamp + defaultStakingRewardsVestingLength),
    ],
    leverageMultiplier,
    lockedUntil,
  ]
  const mockedStaking1: NonNullable<RewardsMockData["staking"]> = {
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
      String(currentBlock.timestamp - defaultStakingRewardsVestingLength - 1),
      String(currentBlock.timestamp + defaultStakingRewardsVestingLength + 1),
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
      currentBlock,
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
      currentBlock,
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
    currentBlock
  )

  assertWithLoadedInfo(user)
  assertAllMocksAreCalled(
    omit(mocks1, [
      "callGFIBalanceMock",
      "callUSDCBalanceMock",
      "callUSDCAllowanceMock",
      "callStakingRewardsBalanceMock",
      "callCommunityRewardsTokenLaunchTimeInSecondsMock",
      "callCommunityRewardsBalanceMock",
      "callCommunityRewardsTokenOfOwnerMock",
      "callGrantsMock",
      "callClaimableRewardsMock",
      "callCommunityRewardsTotalVestedAt",
    ])
  )
  assertAllMocksAreCalled(mocks2)
  return {gfi, stakingRewards, communityRewards, merkleDistributor, user}
}

export async function getDefaultClasses(goldfinchProtocol: GoldfinchProtocol, currentBlock: BlockInfo) {
  const gfi = new GFI(goldfinchProtocol)
  await gfi.initialize(currentBlock)
  const stakingRewards = new StakingRewards(goldfinchProtocol)
  await mockStakingRewardsContractCalls(stakingRewards)
  await stakingRewards.initialize(currentBlock)

  const communityRewards = new CommunityRewards(goldfinchProtocol)
  await communityRewards.initialize(currentBlock)

  const merkleDistributor = new MerkleDistributor(goldfinchProtocol)
  await mockMerkleDistributorContractCalls(merkleDistributor)
  await merkleDistributor.initialize(currentBlock)

  const merkleDirectDistributor = new MerkleDirectDistributor(goldfinchProtocol)
  await mockMerkleDirectDistributorContractCalls(merkleDirectDistributor)
  await merkleDirectDistributor.initialize(currentBlock)

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
  seniorPool: SeniorPoolLoaded,
  currentBlock: BlockInfo
) {
  setupMocksForMerkleDirectDistributorAirdrop(merkleDirectDistributorAirdrop, false)
  const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor} = await getDefaultClasses(
    goldfinchProtocol,
    currentBlock
  )
  const user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
  const mocks = await mockUserInitializationContractCalls(
    user,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    {
      currentBlock,
    }
  )
  await user.initialize(
    seniorPool,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    merkleDirectDistributor,
    currentBlock
  )

  assertWithLoadedInfo(user)
  assertAllMocksAreCalled(mocks)

  return {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user}
}

export async function setupAcceptedDirectReward(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded,
  currentBlock: BlockInfo
) {
  setupMocksForMerkleDirectDistributorAirdrop(merkleDirectDistributorAirdrop, true)

  const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor} = await getDefaultClasses(
    goldfinchProtocol,
    currentBlock
  )
  const user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
  const mocks = await mockUserInitializationContractCalls(
    user,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    {
      currentBlock,
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
    currentBlock
  )

  assertWithLoadedInfo(user)
  assertAllMocksAreCalled(mocks)

  return {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user}
}
