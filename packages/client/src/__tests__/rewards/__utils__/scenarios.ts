import "@testing-library/jest-dom"
import {MerkleDistributorGrantInfo} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDistributor/types"
import {MerkleDistributor, CommunityRewards} from "../../../ethereum/communityRewards"
import {GFI} from "../../../ethereum/gfi"
import {User} from "../../../ethereum/user"
import {SeniorPoolLoaded, StakingRewards} from "../../../ethereum/pool"
import {blockInfo, network, recipient} from "./constants"
import {assertWithLoadedInfo} from "../../../types/loadable"
import {
  mockStakingRewardsContractCalls,
  mockMerkleDistributorContractCalls,
  mockUserInitializationContractCalls,
  setupMocksForAirdrop,
  assertAllMocksAreCalled,
} from "./mocks"
import {GoldfinchProtocol} from "../../../ethereum/GoldfinchProtocol"

export async function setupNewStakingReward(goldfinchProtocol: GoldfinchProtocol, seniorPool: SeniorPoolLoaded) {
  const {gfi, stakingRewards, communityRewards, merkleDistributor} = await getDefaultClasses(goldfinchProtocol)
  const user = new User(recipient, network.name, undefined, goldfinchProtocol, undefined)
  const mocks = mockUserInitializationContractCalls(user, stakingRewards, gfi, communityRewards, merkleDistributor, {
    staking: {},
  })
  await user.initialize(seniorPool, stakingRewards, gfi, communityRewards, merkleDistributor, blockInfo)

  assertWithLoadedInfo(user)
  assertAllMocksAreCalled(mocks)
  return {gfi, stakingRewards, communityRewards, merkleDistributor, user}
}

export async function setupClaimableStakingReward(goldfinchProtocol, seniorPool) {
  const updatedBlockInfo = {...blockInfo}
  updatedBlockInfo.timestamp = 1641564707

  const {gfi, stakingRewards, communityRewards, merkleDistributor} = await getDefaultClasses(goldfinchProtocol)
  const user = new User(recipient, network.name, undefined, goldfinchProtocol, undefined)
  const mocks = mockUserInitializationContractCalls(user, stakingRewards, gfi, communityRewards, merkleDistributor, {
    staking: {
      currentTimestamp: String(updatedBlockInfo.timestamp),
      earnedSince: "129600000000000000000",
      totalVestedAt: "710136986301369863",
    },
  })
  await user.initialize(seniorPool, stakingRewards, gfi, communityRewards, merkleDistributor, updatedBlockInfo)

  assertWithLoadedInfo(user)
  assertAllMocksAreCalled(mocks)

  return {gfi, stakingRewards, communityRewards, merkleDistributor, user}
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
  setupMocksForAirdrop(airdrop)

  const {gfi, stakingRewards, communityRewards, merkleDistributor} = await getDefaultClasses(goldfinchProtocol)
  const user = new User(recipient, network.name, undefined, goldfinchProtocol, undefined)
  const mocks = mockUserInitializationContractCalls(user, stakingRewards, gfi, communityRewards, merkleDistributor, {
    community: {
      airdrop: airdrop,
    },
  })
  await user.initialize(seniorPool, stakingRewards, gfi, communityRewards, merkleDistributor, blockInfo)

  assertWithLoadedInfo(user)
  assertAllMocksAreCalled(mocks)

  return {gfi, stakingRewards, communityRewards, merkleDistributor, user}
}

export async function setupAirdrop(goldfinchProtocol: GoldfinchProtocol, seniorPool: SeniorPoolLoaded) {
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
  setupMocksForAirdrop(airdrop, false)
  const {gfi, stakingRewards, communityRewards, merkleDistributor} = await getDefaultClasses(goldfinchProtocol)
  const user = new User(recipient, network.name, undefined, goldfinchProtocol, undefined)
  const mocks = mockUserInitializationContractCalls(user, stakingRewards, gfi, communityRewards, merkleDistributor, {})
  await user.initialize(seniorPool, stakingRewards, gfi, communityRewards, merkleDistributor, blockInfo)

  assertWithLoadedInfo(user)
  assertAllMocksAreCalled(mocks)

  return {gfi, stakingRewards, communityRewards, merkleDistributor, user}
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
  setupMocksForAirdrop(airdrop)

  const {gfi, stakingRewards, communityRewards, merkleDistributor} = await getDefaultClasses(goldfinchProtocol)
  const user = new User(recipient, network.name, undefined, goldfinchProtocol, undefined)
  const mocks = mockUserInitializationContractCalls(user, stakingRewards, gfi, communityRewards, merkleDistributor, {
    community: {
      airdrop: airdrop,
      grantRes: ["1000000000000000000000", "0", "1641576557", "1641582557", "0", "300", "0"],
      claimable: "0",
    },
  })
  await user.initialize(seniorPool, stakingRewards, gfi, communityRewards, merkleDistributor, blockInfo)

  assertWithLoadedInfo(user)
  assertAllMocksAreCalled(mocks)

  return {gfi, stakingRewards, communityRewards, merkleDistributor, user}
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
  setupMocksForAirdrop(airdrop)

  const {gfi, stakingRewards, communityRewards, merkleDistributor} = await getDefaultClasses(goldfinchProtocol)
  const user = new User(recipient, network.name, undefined, goldfinchProtocol, undefined)
  const mocks = mockUserInitializationContractCalls(user, stakingRewards, gfi, communityRewards, merkleDistributor, {
    staking: {
      currentTimestamp: String(updatedBlockInfo.timestamp),
      earnedSince: "129600000000000000000",
      totalVestedAt: "710136986301369863",
    },
    community: {
      airdrop: airdrop,
    },
  })
  await user.initialize(seniorPool, stakingRewards, gfi, communityRewards, merkleDistributor, updatedBlockInfo)

  assertWithLoadedInfo(user)
  assertAllMocksAreCalled(mocks)

  return {gfi, stakingRewards, communityRewards, merkleDistributor, user}
}

export async function setupPartiallyClaimedStakingReward(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded,
  gfiBalance?: string
) {
  const updatedBlockInfo = {...blockInfo}
  updatedBlockInfo.timestamp = 1641750579

  const {gfi, stakingRewards, communityRewards, merkleDistributor} = await getDefaultClasses(goldfinchProtocol)
  const user = new User(recipient, network.name, undefined, goldfinchProtocol, undefined)
  const mocks = mockUserInitializationContractCalls(user, stakingRewards, gfi, communityRewards, merkleDistributor, {
    staking: {
      currentTimestamp: String(updatedBlockInfo.timestamp),
      earnedSince: "129600000000000000000",
      totalVestedAt: "3059493996955859969",
      granted: "269004000000000000000",
      positionsRes: [
        "50000000000000000000000",
        ["138582358057838660579", "821641942161339421", "0", "821641942161339421", "1641391907", "1672927907"],
        "1000000000000000000",
        "0",
      ],
    },
    gfi: {gfiBalance},
  })
  await user.initialize(seniorPool, stakingRewards, gfi, communityRewards, merkleDistributor, updatedBlockInfo)

  assertWithLoadedInfo(user)
  assertAllMocksAreCalled(mocks)
  return {gfi, stakingRewards, communityRewards, merkleDistributor, user}
}

export async function getDefaultClasses(goldfinchProtocol: GoldfinchProtocol) {
  const gfi = new GFI(goldfinchProtocol)
  await gfi.initialize(blockInfo)
  const stakingRewards = new StakingRewards(goldfinchProtocol)
  mockStakingRewardsContractCalls(stakingRewards)
  await stakingRewards.initialize(blockInfo)

  const communityRewards = new CommunityRewards(goldfinchProtocol)
  await communityRewards.initialize(blockInfo)

  const merkleDistributor = new MerkleDistributor(goldfinchProtocol)
  mockMerkleDistributorContractCalls(merkleDistributor)
  await merkleDistributor.initialize(blockInfo)

  assertWithLoadedInfo(gfi)
  assertWithLoadedInfo(stakingRewards)
  assertWithLoadedInfo(communityRewards)
  assertWithLoadedInfo(merkleDistributor)

  return {
    gfi,
    stakingRewards,
    communityRewards,
    merkleDistributor,
  }
}
