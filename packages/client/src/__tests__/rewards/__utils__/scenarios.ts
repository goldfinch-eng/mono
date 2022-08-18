import mapValues from "lodash/mapValues"
import "@testing-library/jest-dom"
import {MerkleDistributorGrantInfo} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDistributor/types"
import {CommunityRewards, CommunityRewardsLoaded} from "../../../ethereum/communityRewards"
import {GFI, GFILoaded, GFI_DECIMALS} from "../../../ethereum/gfi"
import {
  User,
  UserBackerMerkleDirectDistributor,
  UserBackerMerkleDistributor,
  UserCommunityRewards,
  UserMerkleDirectDistributor,
  UserMerkleDistributor,
} from "../../../ethereum/user"
import {SeniorPoolLoaded, StakedPositionType, StakingRewards, StakingRewardsLoaded} from "../../../ethereum/pool"
import {network, recipient} from "./constants"
import {assertWithLoadedInfo} from "../../../types/loadable"
import {
  mockStakingRewardsContractCalls,
  mockMerkleDistributorContractCalls,
  mockUserRelatedInitializationContractCalls,
  setupMocksForMerkleDistributorAirdrop,
  assertAllMocksAreCalled,
  RewardsMockData,
  mockMerkleDirectDistributorContractCalls,
  setupMocksForMerkleDirectDistributorAirdrop,
  defaultStakingRewardsVestingLength,
  mockGfiContractCalls,
  mockBackerMerkleDistributorContractCalls,
  mockBackerMerkleDirectDistributorContractCalls,
  MerkleDistributorConfigMock,
  mockBackerRewardsContractCalls,
  mockCommunityRewardsContractCalls,
} from "./mocks"
import {GoldfinchProtocol} from "../../../ethereum/GoldfinchProtocol"
import {CreditDesk} from "../../../@types/legacy/CreditDesk"
import omit from "lodash/omit"
import {MerkleDirectDistributorGrantInfo} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDirectDistributor/types"
import BigNumber from "bignumber.js"
import {BlockInfo} from "../../../utils"
import {MerkleDistributor, MerkleDistributorLoaded} from "../../../ethereum/merkleDistributor"
import {MerkleDirectDistributor, MerkleDirectDistributorLoaded} from "../../../ethereum/merkleDirectDistributor"
import {Web3IO} from "../../../types/web3"
import {
  BackerMerkleDirectDistributorLoaded,
  BackerMerkleDirectDistributor,
} from "../../../ethereum/backerMerkleDirectDistributor"
import {BackerMerkleDistributorLoaded, BackerMerkleDistributor} from "../../../ethereum/backerMerkleDistributor"
import {BackerRewards, BackerRewardsLoaded} from "../../../ethereum/backerRewards"

export async function prepareUserRelatedDeps(
  deps: {
    goldfinchProtocol: GoldfinchProtocol
    seniorPool: SeniorPoolLoaded
    stakingRewards: StakingRewardsLoaded
    gfi: GFILoaded
    communityRewards: CommunityRewardsLoaded
    merkleDistributor: MerkleDistributorLoaded
    backerMerkleDistributor: BackerMerkleDistributorLoaded
    merkleDirectDistributor: MerkleDirectDistributorLoaded
    backerMerkleDirectDistributor: BackerMerkleDirectDistributorLoaded
    backerRewards: BackerRewardsLoaded
  },
  rewardsMock: RewardsMockData
) {
  const user = new User(
    recipient,
    network.name,
    undefined as unknown as Web3IO<CreditDesk>,
    deps.goldfinchProtocol,
    undefined
  )
  const userMerkleDistributor = new UserMerkleDistributor(recipient, deps.goldfinchProtocol)
  const userMerkleDirectDistributor = new UserMerkleDirectDistributor(recipient, deps.goldfinchProtocol)
  const userBackerMerkleDirectDistributor = new UserBackerMerkleDirectDistributor(recipient, deps.goldfinchProtocol)
  const userCommunityRewards = new UserCommunityRewards(recipient, deps.goldfinchProtocol)
  const userBackerMerkleDistributor = new UserBackerMerkleDistributor(recipient, deps.goldfinchProtocol)
  const mocks = await mockUserRelatedInitializationContractCalls(
    user,
    deps.stakingRewards,
    deps.gfi,
    deps.communityRewards,
    deps.merkleDistributor,
    deps.merkleDirectDistributor,
    deps.backerMerkleDistributor,
    deps.backerMerkleDirectDistributor,
    deps.backerRewards,
    rewardsMock
  )
  await user.initialize(
    deps.seniorPool,
    deps.stakingRewards,
    deps.gfi,
    deps.communityRewards,
    deps.merkleDistributor,
    deps.merkleDirectDistributor,
    deps.backerMerkleDistributor,
    deps.backerMerkleDirectDistributor,
    rewardsMock.currentBlock
  )
  assertWithLoadedInfo(user)

  await userMerkleDistributor.initialize(deps.merkleDistributor, deps.communityRewards, rewardsMock.currentBlock)
  assertWithLoadedInfo(userMerkleDistributor)

  await userMerkleDirectDistributor.initialize(deps.merkleDirectDistributor, rewardsMock.currentBlock)
  assertWithLoadedInfo(userMerkleDirectDistributor)

  await userBackerMerkleDirectDistributor.initialize(deps.backerMerkleDirectDistributor, rewardsMock.currentBlock)
  assertWithLoadedInfo(userBackerMerkleDirectDistributor)

  await userBackerMerkleDistributor.initialize(
    deps.backerMerkleDistributor,
    deps.communityRewards,
    rewardsMock.currentBlock
  )
  assertWithLoadedInfo(userBackerMerkleDistributor)

  await userCommunityRewards.initialize(
    deps.communityRewards,
    deps.merkleDistributor,
    deps.backerMerkleDistributor,
    userMerkleDistributor,
    userBackerMerkleDistributor,
    rewardsMock.currentBlock
  )
  assertWithLoadedInfo(userCommunityRewards)

  assertAllMocksAreCalled(mapValues(mocks, (val) => (val.expectCalledBeforeRender ? val.mock : undefined)))

  return {
    user,
    userMerkleDistributor,
    userMerkleDirectDistributor,
    userBackerMerkleDistributor,
    userBackerMerkleDirectDistributor,
    userCommunityRewards,
  }
}

export async function setupNewStakingReward(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded,
  currentBlock: BlockInfo
) {
  const baseDeps = await prepareBaseDeps(goldfinchProtocol, currentBlock)
  const userRelated = await prepareUserRelatedDeps(
    {goldfinchProtocol, seniorPool, ...baseDeps},
    {
      currentBlock,
      staking: {},
    }
  )

  return {...baseDeps, ...userRelated}
}

export async function setupClaimableStakingReward(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded,
  currentBlock: BlockInfo
) {
  const baseDeps = await prepareBaseDeps(goldfinchProtocol, currentBlock)
  const userRelated = await prepareUserRelatedDeps(
    {goldfinchProtocol, seniorPool, ...baseDeps},
    {
      currentBlock,
      staking: {
        earnedSinceLastCheckpoint: "129600000000000000000",
        totalVestedAt: "710136986301369863",
      },
    }
  )

  return {...baseDeps, ...userRelated}
}

export const merkleDistributorAirdropNoVesting: MerkleDistributorGrantInfo = {
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

export const backerMerkleDistributorAirdropNoVesting: MerkleDistributorGrantInfo = {
  index: 0,
  account: recipient,
  reason: "backer",
  grant: {
    amount: "0x3635c9adc5dea00000",
    vestingLength: "0x00",
    cliffLength: "0x00",
    vestingInterval: "0x01",
  },
  proof: ["0x00", "0x00", "0x00"],
}

export const merkleDistributorAirdropVesting: MerkleDistributorGrantInfo = {
  index: 0,
  account: recipient,
  reason: "goldfinch_investment",
  grant: {
    amount: "0x3635c9adc5dea00000",
    vestingLength: "0x1e13380",
    cliffLength: "0x00",
    vestingInterval: "0x01",
  },
  proof: ["0x00", "0x00", "0x00"],
}

export const backerMerkleDistributorAirdropVesting: MerkleDistributorGrantInfo = {
  index: 0,
  account: recipient,
  reason: "backer",
  grant: {
    amount: "0x3635c9adc5dea00000",
    vestingLength: "0x1e13380",
    cliffLength: "0x00",
    vestingInterval: "0x01",
  },
  proof: ["0x00", "0x00", "0x00"],
}

export const partiallyClaimedBackerAirdrop: MerkleDistributorGrantInfo = {
  index: 2,
  account: recipient,
  reason: "backer",
  grant: {
    amount: "0x3635c9adc5dea00000",
    vestingLength: "0x01e13380",
    cliffLength: "0x00",
    vestingInterval: "0x01",
  },
  proof: ["0x00", "0x00", "0x00"],
}

export const partiallyClaimedAirdrop: MerkleDistributorGrantInfo = {
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

export async function setupClaimableCommunityReward(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded,
  currentBlock: BlockInfo,
  isBacker = false
) {
  if (isBacker) {
    setupMocksForMerkleDistributorAirdrop({
      backerDistributor: {airdrop: backerMerkleDistributorAirdropNoVesting, isAccepted: true},
    })
  } else {
    setupMocksForMerkleDistributorAirdrop({distributor: {airdrop: merkleDistributorAirdropNoVesting, isAccepted: true}})
  }

  const baseDeps = await prepareBaseDeps(goldfinchProtocol, currentBlock)
  const userRelatedDeps = await prepareUserRelatedDeps(
    {goldfinchProtocol, seniorPool, ...baseDeps},
    {
      currentBlock,
      community: {
        airdrop: merkleDistributorAirdropNoVesting,
        isFromBacker: isBacker,
      },
    }
  )

  return {...baseDeps, ...userRelatedDeps}
}

export async function setupMerkleDistributorAirdropNoVesting(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded,
  currentBlock: BlockInfo,
  config: {
    distributor: boolean
    backerDistributor: boolean
  }
) {
  const merkleConfig = getMerkleConfig(config)
  setupMocksForMerkleDistributorAirdrop(merkleConfig)
  const baseDeps = await prepareBaseDeps(goldfinchProtocol, currentBlock)
  const userRelatedDeps = await prepareUserRelatedDeps(
    {goldfinchProtocol, seniorPool, ...baseDeps},
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

  return {...baseDeps, ...userRelatedDeps}
}

function getMerkleConfig(
  config: {distributor: boolean; backerDistributor: boolean},
  vesting = false
): MerkleDistributorConfigMock {
  let merkleConfig: MerkleDistributorConfigMock = {
    distributor: undefined,
    backerDistributor: undefined,
  }
  if (config.distributor) {
    const airdrop = vesting ? merkleDistributorAirdropVesting : merkleDistributorAirdropNoVesting
    merkleConfig["distributor"] = {airdrop, isAccepted: false}
  }

  if (config.backerDistributor) {
    const airdrop = vesting ? backerMerkleDistributorAirdropVesting : backerMerkleDistributorAirdropNoVesting
    merkleConfig["backerDistributor"] = {airdrop, isAccepted: false}
  }
  return merkleConfig
}

export async function setupMerkleDistributorAirdropVesting(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded,
  tokenLaunchTime: string,
  totalVestedAt: string,
  currentBlock: BlockInfo,
  config: {
    distributor: boolean
    backerDistributor: boolean
  }
) {
  const merkleConfig = getMerkleConfig(config, true)
  setupMocksForMerkleDistributorAirdrop(merkleConfig)
  const baseDeps = await prepareBaseDeps(goldfinchProtocol, currentBlock)
  const userRelatedDeps = await prepareUserRelatedDeps(
    {goldfinchProtocol, seniorPool, ...baseDeps},
    {
      currentBlock,
      tokenLaunchTime,
      notAcceptedMerkleDistributorGrant: {
        amount: new BigNumber(merkleDistributorAirdropVesting.grant.amount).toString(10),
        vestingLength: new BigNumber(merkleDistributorAirdropVesting.grant.vestingLength).toString(10),
        cliffLength: new BigNumber(merkleDistributorAirdropVesting.grant.cliffLength).toString(10),
        vestingInterval: new BigNumber(merkleDistributorAirdropVesting.grant.vestingInterval).toString(10),
        revokedAt: "0",
        totalVestedAt,
      },
    }
  )

  return {...baseDeps, ...userRelatedDeps}
}

export async function setupVestingCommunityReward(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded,
  currentBlock: BlockInfo,
  isBacker = false
) {
  let airdrop: MerkleDistributorGrantInfo
  if (isBacker) {
    airdrop = {
      index: 2,
      account: recipient,
      reason: "backer",
      grant: {
        amount: "0x3635c9adc5dea00000",
        vestingLength: "0x1770",
        cliffLength: "0x00",
        vestingInterval: "0x012c",
      },
      proof: ["0x00", "0x00", "0x00"],
    }
    setupMocksForMerkleDistributorAirdrop({backerDistributor: {airdrop, isAccepted: true}})
  } else {
    airdrop = {
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
    setupMocksForMerkleDistributorAirdrop({distributor: {airdrop, isAccepted: true}})
  }

  const baseDeps = await prepareBaseDeps(goldfinchProtocol, currentBlock)
  const userRelatedDeps = await prepareUserRelatedDeps(
    {goldfinchProtocol, seniorPool, ...baseDeps},
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
        isFromBacker: isBacker,
      },
    }
  )
  return {...baseDeps, ...userRelatedDeps}
}

export async function setupPartiallyClaimedCommunityReward(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded,
  gfiBalance: string | undefined,
  currentBlock: BlockInfo,
  isBacker = false
) {
  let airdrop: MerkleDistributorGrantInfo
  if (isBacker) {
    airdrop = {...partiallyClaimedBackerAirdrop}
    setupMocksForMerkleDistributorAirdrop({backerDistributor: {airdrop, isAccepted: true}})
  } else {
    airdrop = {...partiallyClaimedAirdrop}
    setupMocksForMerkleDistributorAirdrop({distributor: {airdrop, isAccepted: true}})
  }

  const baseDeps = await prepareBaseDeps(goldfinchProtocol, currentBlock)
  const tokenLaunchTime = String(currentBlock.timestamp - 518422)
  const userRelatedDeps = await prepareUserRelatedDeps(
    {goldfinchProtocol, seniorPool, ...baseDeps},
    {
      currentBlock,
      tokenLaunchTime,
      community: {
        airdrop: airdrop,
        grantRes: [
          "1000000000000000000000",
          "5480149670218163368",
          tokenLaunchTime,
          String(currentBlock.timestamp + 29726437),
          "0",
          "1",
          "0",
        ],
        claimable: "10958904109589041096",
        isFromBacker: isBacker,
      },
      gfi: {gfiBalance},
    }
  )

  return {...baseDeps, ...userRelatedDeps}
}

export async function setupClaimableBackerReward(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded,
  poolTokenInfos: Array<{
    poolTokenId: string
    claimableBackersOnly: BigNumber
    claimableSeniorPoolMatching: BigNumber
    claimedBackersOnly: BigNumber
    claimedSeniorPoolMatching: BigNumber
  }>,
  currentBlock: BlockInfo
) {
  const baseDeps = await prepareBaseDeps(goldfinchProtocol, currentBlock)
  const userRelated = await prepareUserRelatedDeps(
    {goldfinchProtocol, seniorPool, ...baseDeps},
    {
      backer: {
        poolTokenInfos: poolTokenInfos.map((info) => ({
          id: info.poolTokenId,
          poolTokenClaimableRewards: info.claimableBackersOnly.toString(10),
          stakingRewardsEarnedSinceLastWithdraw: info.claimableSeniorPoolMatching.toString(10),
          backerRewardsTokenInfo: [
            info.claimedBackersOnly.toString(10),
            new BigNumber(0).multipliedBy(GFI_DECIMALS).toString(10),
          ],
          stakingRewardsClaimed: info.claimedSeniorPoolMatching.toString(10),
        })),
      },
      currentBlock,
    }
  )

  return {...baseDeps, ...userRelated}
}

export async function setupCommunityRewardAndStakingReward(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded,
  currentBlock: BlockInfo
) {
  setupMocksForMerkleDistributorAirdrop({distributor: {airdrop: merkleDistributorAirdropNoVesting, isAccepted: true}})

  const baseDeps = await prepareBaseDeps(goldfinchProtocol, currentBlock)
  const userRelatedDeps = await prepareUserRelatedDeps(
    {goldfinchProtocol, seniorPool, ...baseDeps},
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
  return {...baseDeps, ...userRelatedDeps}
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
const backerMerkleDirectDistributorAirdrop: MerkleDirectDistributorGrantInfo = {
  index: 0,
  account: recipient,
  reason: "backer",
  grant: {
    amount: merkleDirectDistributorAirdropAmountHex,
  },
  proof: ["0x00", "0x00", "0x00"],
}

export async function setupDirectReward(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded,
  currentBlock: BlockInfo,
  isBacker = false
) {
  if (isBacker) {
    setupMocksForMerkleDirectDistributorAirdrop(goldfinchProtocol, {
      backerDistributor: {airdrop: backerMerkleDirectDistributorAirdrop, isAccepted: true},
    })
  } else {
    setupMocksForMerkleDirectDistributorAirdrop(goldfinchProtocol, {
      distributor: {airdrop: merkleDirectDistributorAirdrop, isAccepted: true},
    })
  }

  const baseDeps = await prepareBaseDeps(goldfinchProtocol, currentBlock)
  const userRelatedDeps = await prepareUserRelatedDeps(
    {goldfinchProtocol, seniorPool, ...baseDeps},
    {
      currentBlock,
      gfi: {
        gfiBalance: merkleDirectDistributorAirdropAmount,
      },
    }
  )
  return {...baseDeps, ...userRelatedDeps}
}

export async function setupDirectRewardAndStakingReward(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded,
  currentBlock: BlockInfo
) {
  setupMocksForMerkleDirectDistributorAirdrop(goldfinchProtocol, {
    distributor: {airdrop: merkleDirectDistributorAirdrop, isAccepted: true},
  })

  const baseDeps = await prepareBaseDeps(goldfinchProtocol, currentBlock)
  const userRelatedDeps = await prepareUserRelatedDeps(
    {goldfinchProtocol, seniorPool, ...baseDeps},
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
  return {...baseDeps, ...userRelatedDeps}
}

export async function setupCommunityRewardAndDirectRewardAndStakingReward(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded,
  currentBlock: BlockInfo
) {
  setupMocksForMerkleDistributorAirdrop({distributor: {airdrop: merkleDistributorAirdropNoVesting, isAccepted: true}})

  setupMocksForMerkleDirectDistributorAirdrop(goldfinchProtocol, {
    distributor: {airdrop: merkleDirectDistributorAirdrop, isAccepted: true},
  })

  const baseDeps = await prepareBaseDeps(goldfinchProtocol, currentBlock)
  const userRelatedDeps = await prepareUserRelatedDeps(
    {goldfinchProtocol, seniorPool, ...baseDeps},
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
  return {...baseDeps, ...userRelatedDeps}
}

export async function setupPartiallyClaimedStakingReward(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded,
  gfiBalance: string | undefined,
  currentBlock: BlockInfo
) {
  const baseDeps = await prepareBaseDeps(goldfinchProtocol, currentBlock)
  const userRelatedDeps = await prepareUserRelatedDeps(
    {goldfinchProtocol, seniorPool, ...baseDeps},
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
          StakedPositionType.Fidu.toString(),
          "1000000000000000000",
          "1000000000000000000",
        ],
      },
      gfi: {gfiBalance},
    }
  )
  return {...baseDeps, ...userRelatedDeps}
}

export async function setupMultiplePartiallyClaimedStakingRewards(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded,
  gfiBalance: string | undefined,
  currentBlock: BlockInfo
) {
  const baseDeps = await prepareBaseDeps(goldfinchProtocol, currentBlock)
  const user = new User(
    recipient,
    network.name,
    undefined as unknown as Web3IO<CreditDesk>,
    goldfinchProtocol,
    undefined
  )
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
    StakedPositionType.Fidu.toString(),
    "1000000000000000000",
    "1000000000000000000",
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
    StakedPositionType.Fidu.toString(),
    "1000000000000000000",
    "1000000000000000000",
  ]
  const mockedStaking2 = {
    ...mockedStaking1,
    positionsRes: mockedPositionRes2,
    stakingRewardsTokenId: "2",
  }
  const mocks1 = await mockUserRelatedInitializationContractCalls(
    user,
    baseDeps.stakingRewards,
    baseDeps.gfi,
    baseDeps.communityRewards,
    baseDeps.merkleDistributor,
    baseDeps.merkleDirectDistributor,
    baseDeps.backerMerkleDistributor,
    baseDeps.backerMerkleDirectDistributor,
    baseDeps.backerRewards,
    {
      currentBlock,
      staking: mockedStaking1,
    }
  )
  const mocks2 = await mockUserRelatedInitializationContractCalls(
    user,
    baseDeps.stakingRewards,
    baseDeps.gfi,
    baseDeps.communityRewards,
    baseDeps.merkleDistributor,
    baseDeps.merkleDirectDistributor,
    baseDeps.backerMerkleDistributor,
    baseDeps.backerMerkleDirectDistributor,
    baseDeps.backerRewards,
    {
      currentBlock,
      staking: mockedStaking2,
      gfi: {gfiBalance},
    }
  )
  await user.initialize(
    seniorPool,
    baseDeps.stakingRewards,
    baseDeps.gfi,
    baseDeps.communityRewards,
    baseDeps.merkleDistributor,
    baseDeps.merkleDirectDistributor,
    baseDeps.backerMerkleDistributor,
    baseDeps.backerMerkleDirectDistributor,
    currentBlock
  )

  assertWithLoadedInfo(user)

  const userMerkleDistributor = new UserMerkleDistributor(recipient, goldfinchProtocol)
  const userMerkleDirectDistributor = new UserMerkleDirectDistributor(recipient, goldfinchProtocol)
  const userBackerMerkleDirectDistributor = new UserBackerMerkleDirectDistributor(recipient, goldfinchProtocol)
  const userBackerMerkleDistributor = new UserBackerMerkleDistributor(recipient, goldfinchProtocol)
  const userCommunityRewards = new UserCommunityRewards(recipient, goldfinchProtocol)

  await userMerkleDistributor.initialize(baseDeps.merkleDistributor, baseDeps.communityRewards, currentBlock)
  assertWithLoadedInfo(userMerkleDistributor)

  await userMerkleDirectDistributor.initialize(baseDeps.merkleDirectDistributor, currentBlock)
  assertWithLoadedInfo(userMerkleDirectDistributor)

  await userBackerMerkleDirectDistributor.initialize(baseDeps.backerMerkleDirectDistributor, currentBlock)
  assertWithLoadedInfo(userBackerMerkleDirectDistributor)

  await userBackerMerkleDistributor.initialize(
    baseDeps.backerMerkleDistributor,
    baseDeps.communityRewards,
    currentBlock
  )
  assertWithLoadedInfo(userBackerMerkleDistributor)

  await userCommunityRewards.initialize(
    baseDeps.communityRewards,
    baseDeps.merkleDistributor,
    baseDeps.backerMerkleDistributor,
    userMerkleDistributor,
    userBackerMerkleDistributor,
    currentBlock
  )
  assertWithLoadedInfo(userCommunityRewards)

  assertAllMocksAreCalled(
    omit(
      mapValues(mocks1, (val) => (val.expectCalledBeforeRender ? val.mock : undefined)),
      [
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
        "callBackerRewardsPoolTokenClaimableRewards",
        "callBackerRewardsStakingRewardsEarnedSinceLastWithdraw",
        "callBackerRewardsTokens",
        "callBackerRewardsStakingRewardsClaimed",
      ]
    )
  )
  assertAllMocksAreCalled(mapValues(mocks2, (val) => (val.expectCalledBeforeRender ? val.mock : undefined)))

  return {
    ...baseDeps,
    user,
    userMerkleDistributor,
    userMerkleDirectDistributor,
    userCommunityRewards,
    userBackerMerkleDistributor,
    userBackerMerkleDirectDistributor,
  }
}

export async function prepareBaseDeps(goldfinchProtocol: GoldfinchProtocol, currentBlock: BlockInfo) {
  const gfi = new GFI(goldfinchProtocol)
  await mockGfiContractCalls(gfi)
  await gfi.initialize(currentBlock)

  const stakingRewards = new StakingRewards(goldfinchProtocol)
  await mockStakingRewardsContractCalls(stakingRewards)
  await stakingRewards.initialize(currentBlock)

  const communityRewards = new CommunityRewards(goldfinchProtocol)
  await mockCommunityRewardsContractCalls(communityRewards)
  await communityRewards.initialize(currentBlock)

  const merkleDistributor = new MerkleDistributor(goldfinchProtocol)
  await mockMerkleDistributorContractCalls(merkleDistributor)
  await merkleDistributor.initialize(currentBlock)

  const merkleDirectDistributor = new MerkleDirectDistributor(goldfinchProtocol)
  await mockMerkleDirectDistributorContractCalls(merkleDirectDistributor)
  await merkleDirectDistributor.initialize(currentBlock)

  const backerMerkleDirectDistributor = new BackerMerkleDirectDistributor(goldfinchProtocol)
  await mockBackerMerkleDirectDistributorContractCalls(backerMerkleDirectDistributor)
  await backerMerkleDirectDistributor.initialize(currentBlock)

  const backerMerkleDistributor = new BackerMerkleDistributor(goldfinchProtocol)
  await mockBackerMerkleDistributorContractCalls(backerMerkleDistributor)
  await backerMerkleDistributor.initialize(currentBlock)

  const backerRewards = new BackerRewards(goldfinchProtocol)
  await mockBackerRewardsContractCalls(backerRewards)
  await backerRewards.initialize(currentBlock)

  assertWithLoadedInfo(gfi)
  assertWithLoadedInfo(stakingRewards)
  assertWithLoadedInfo(communityRewards)
  assertWithLoadedInfo(merkleDistributor)
  assertWithLoadedInfo(backerMerkleDistributor)
  assertWithLoadedInfo(merkleDirectDistributor)
  assertWithLoadedInfo(backerMerkleDirectDistributor)
  assertWithLoadedInfo(backerRewards)

  return {
    gfi,
    stakingRewards,
    communityRewards,
    merkleDistributor,
    backerMerkleDistributor,
    backerMerkleDirectDistributor,
    merkleDirectDistributor,
    backerRewards,
  }
}

export async function setupMerkleDirectDistributorAirdrop(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded,
  currentBlock: BlockInfo,
  isBacker = false
) {
  if (isBacker) {
    setupMocksForMerkleDirectDistributorAirdrop(goldfinchProtocol, {
      backerDistributor: {airdrop: backerMerkleDirectDistributorAirdrop, isAccepted: false},
    })
  } else {
    setupMocksForMerkleDirectDistributorAirdrop(goldfinchProtocol, {
      distributor: {airdrop: merkleDirectDistributorAirdrop, isAccepted: false},
    })
  }
  const baseDeps = await prepareBaseDeps(goldfinchProtocol, currentBlock)
  const userRelatedDeps = await prepareUserRelatedDeps({goldfinchProtocol, seniorPool, ...baseDeps}, {currentBlock})
  return {...baseDeps, ...userRelatedDeps}
}

export async function setupAcceptedDirectReward(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPool: SeniorPoolLoaded,
  currentBlock: BlockInfo,
  isBacker = false
) {
  if (isBacker) {
    setupMocksForMerkleDirectDistributorAirdrop(goldfinchProtocol, {
      distributor: {airdrop: backerMerkleDirectDistributorAirdrop, isAccepted: true},
    })
  } else {
    setupMocksForMerkleDirectDistributorAirdrop(goldfinchProtocol, {
      distributor: {airdrop: merkleDirectDistributorAirdrop, isAccepted: true},
    })
  }

  const baseDeps = await prepareBaseDeps(goldfinchProtocol, currentBlock)
  const userRelatedDeps = await prepareUserRelatedDeps(
    {goldfinchProtocol, seniorPool, ...baseDeps},
    {
      currentBlock,
      gfi: {
        gfiBalance: merkleDirectDistributorAirdropAmount,
      },
    }
  )
  return {...baseDeps, ...userRelatedDeps}
}
