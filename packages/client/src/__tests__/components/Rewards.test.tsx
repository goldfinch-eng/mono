import "@testing-library/jest-dom"
import {mock, resetMocks} from "depay-web3-mock"
import {render, screen} from "@testing-library/react"
import {BrowserRouter as Router} from "react-router-dom"
import {AppContext} from "../../App"
import web3 from "../../web3"
import Rewards from "../../pages/rewards"
import {
  MerkleDistributorLoaded,
  CommunityRewardsLoaded,
  MerkleDistributor,
  CommunityRewards,
} from "../../ethereum/communityRewards"
import {GFI, GFILoaded} from "../../ethereum/gfi"
import {User} from "../../ethereum/user"
import {SeniorPool, StakingRewards, StakingRewardsLoaded} from "../../ethereum/pool"
import {UserLoaded} from "../../ethereum/user"
import {
  blockchain,
  blockInfo,
  communityRewardsABI,
  DEPLOYMENTS,
  erc20ABI,
  gfiABI,
  merkleDistributorABI,
  network,
  recipient,
  stakingRewardsABI,
} from "../constants"
import {assertWithLoadedInfo} from "../../types/loadable"
import {GoldfinchProtocol} from "../../ethereum/GoldfinchProtocol"
import * as utils from "../../ethereum/utils"

mock({
  blockchain: "ethereum",
})

web3.setProvider(global.ethereum)

interface StakingRewardsMockData {
  hasRewards: boolean
  hasCommunityRewards: boolean
  positionsRes?:
    | {
        0: string
        1: [string, string, string, string, string, string]
        2: string
        3: string
      }
    | undefined
  earnedSince?: string | undefined
  totalVestedAt?: string | undefined
  currentTimestamp?: string | undefined
  positionCurrentEarnRate?: string | undefined
}

function mockUserInitializationContractCalls(
  user: User,
  stakingRewards: StakingRewards,
  gfi: GFI,
  communityRewards: CommunityRewards,
  stakingRewardsMock?: StakingRewardsMockData | undefined
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
  if (stakingRewardsMock?.hasRewards) {
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
  if (stakingRewardsMock) {
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
        params: [positionsRes[1][4], positionsRes[1][5], currentTimestamp, earnedSince],
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

  // if (stakingRewardsMock?.hasCommunityRewards) {
  //   // continue with the calls
  // }

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
  }
}

function mockStakingRewardsContractCalls(stakingRewards, currentEarnRatePerToken?: string | undefined) {
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

function mockMerkleDistributorContractCalls(
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

function renderRewards(
  stakingRewards: StakingRewardsLoaded | undefined,
  gfi: GFILoaded | undefined,
  user: UserLoaded | undefined,
  merkleDistributor: MerkleDistributorLoaded | undefined,
  communityRewards: CommunityRewardsLoaded | undefined
) {
  const store = {
    currentBlock: blockInfo,
    network,
    stakingRewards,
    gfi,
    user,
    merkleDistributor,
    communityRewards,
  }

  return render(
    <AppContext.Provider value={store}>
      <Router>
        <Rewards />
      </Router>
    </AppContext.Provider>
  )
}

async function getDefaultClasses(goldfinchProtocol) {
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

describe("Rewards portfolio overview", () => {
  let seniorPool
  let goldfinchProtocol = new GoldfinchProtocol(network)

  beforeEach(resetMocks)
  beforeEach(() => mock({blockchain, accounts: {return: [recipient]}}))
  beforeEach(async () => {
    jest.spyOn(utils, "getDeployments").mockImplementation(() => {
      return DEPLOYMENTS
    })
    jest.spyOn(utils, "getMerkleDistributorInfo").mockImplementation(() => {
      return {merkleRoot: "0x0", amount: "0", grants: []}
    })

    await goldfinchProtocol.initialize()
    seniorPool = new SeniorPool(goldfinchProtocol)
    seniorPool.info = {
      loaded: true,
      value: {
        currentBlock: blockInfo,
        poolData: {},
        isPaused: false,
      },
    }
  })

  it("shows loading message", async () => {
    let stakingRewards
    let gfi
    let user
    let merkleDistributor
    let communityRewards
    renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

    expect(await screen.findByText("Loading...")).toBeVisible()
  })

  it("shows empty portfolio", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor} = await getDefaultClasses(goldfinchProtocol)

    const user = new User(recipient, network.name, undefined, goldfinchProtocol, undefined)
    const {
      callGFIBalanceMock,
      callUSDCBalanceMock,
      callUSDCAllowanceMock,
      callStakingRewardsBalanceMock,
      callCommunityRewardsBalanceMock,
    } = mockUserInitializationContractCalls(user, stakingRewards, gfi, communityRewards, false)
    await user.initialize(seniorPool, stakingRewards, gfi, communityRewards, merkleDistributor, blockInfo)
    expect(callGFIBalanceMock).toHaveBeenCalled()
    expect(callUSDCBalanceMock).toHaveBeenCalled()
    expect(callUSDCAllowanceMock).toHaveBeenCalled()
    expect(callStakingRewardsBalanceMock).toHaveBeenCalled()
    expect(callCommunityRewardsBalanceMock).toHaveBeenCalled()
    assertWithLoadedInfo(user)

    renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

    expect(await screen.findByText("Total GFI balance")).toBeVisible()
    expect(await screen.findByText("Wallet balance")).toBeVisible()
    expect(await screen.findByText("Claimable")).toBeVisible()
    expect(await screen.findByText("Still vesting")).toBeVisible()
    expect(await screen.getAllByText("0.00")[0]).toBeVisible()
  })

  it("staking rewards with zero dont count for portfolio", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor} = await getDefaultClasses(goldfinchProtocol)
    const user = new User(recipient, network.name, undefined, goldfinchProtocol, undefined)
    mockUserInitializationContractCalls(user, stakingRewards, gfi, communityRewards, {
      hasRewards: true,
      hasCommunityRewards: false,
    })
    await user.initialize(seniorPool, stakingRewards, gfi, communityRewards, merkleDistributor, blockInfo)

    assertWithLoadedInfo(user)

    renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

    expect(await screen.findByText("Total GFI balance")).toBeVisible()
    expect(await screen.findByText("Wallet balance")).toBeVisible()
    expect(await screen.findByText("Claimable")).toBeVisible()
    expect(await screen.findByText("Still vesting")).toBeVisible()

    const element = screen.getByTestId("rewards-summary")
    expect(element.getElementsByClassName("disabled-value").length).toBe(4)
    const summaryValues = await element.getElementsByClassName("disabled-value")
    expect(summaryValues[0]?.textContent).toEqual("0.00")
    expect(summaryValues[1]?.textContent).toEqual("0.00")
    expect(summaryValues[2]?.textContent).toEqual("0.00")
    expect(summaryValues[3]?.textContent).toEqual("0.00")
  })

  it("vesting staking rewards appear on portfolio", async () => {
    const updatedBlockInfo = blockInfo
    updatedBlockInfo.timestamp = 1641564707

    const {gfi, stakingRewards, communityRewards, merkleDistributor} = await getDefaultClasses(goldfinchProtocol)
    const user = new User(recipient, network.name, undefined, goldfinchProtocol, undefined)
    mockUserInitializationContractCalls(user, stakingRewards, gfi, communityRewards, {
      hasRewards: true,
      hasCommunityRewards: false,
      currentTimestamp: String(updatedBlockInfo.timestamp),
      earnedSince: "129600000000000000000",
      totalVestedAt: "710136986301369863",
    })
    await user.initialize(seniorPool, stakingRewards, gfi, communityRewards, merkleDistributor, updatedBlockInfo)

    assertWithLoadedInfo(user)

    renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

    expect(await screen.findByText("Total GFI balance")).toBeVisible()
    expect(await screen.findByText("Wallet balance")).toBeVisible()
    expect(await screen.findByText("Claimable")).toBeVisible()
    expect(await screen.findByText("Still vesting")).toBeVisible()

    const element = screen.getByTestId("rewards-summary")
    expect(element.getElementsByClassName("value").length).toBe(4)
    const summaryValues = await element.getElementsByClassName("value")
    expect(summaryValues[0]?.textContent).toEqual("0.00")
    expect(summaryValues[1]?.textContent).toEqual("0.71")
    expect(summaryValues[2]?.textContent).toEqual("128.89")
    expect(summaryValues[3]?.textContent).toEqual("129.60")
  })

  // it("shows community rewards on portfolio", async () => {
  //   const {gfi, stakingRewards, communityRewards, merkleDistributor} = await getDefaultClasses(goldfinchProtocol)
  //   const user = new User(recipient, network.name, undefined, goldfinchProtocol, undefined)
  //   mockUserInitializationContractCalls(user, stakingRewards, gfi, communityRewards, {
  //     hasRewards: false,
  //     hasCommunityRewards: true,
  //   })
  //   await user.initialize(seniorPool, stakingRewards, gfi, communityRewards, merkleDistributor, blockInfo)

  //   assertWithLoadedInfo(user)
  //   renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

  //   expect(await screen.findByText("Wallet balance")).toBeVisible()
  //   expect(await screen.findByText("Claimable")).toBeVisible()
  //   expect(await screen.findByText("Still vesting")).toBeVisible()
  //   expect(await screen.findByText("Total GFI balance")).toBeVisible()

  //   const element = screen.getByTestId("rewards-summary")
  //   expect(element.getElementsByClassName("value").length).toBe(4)
  //   const summaryValues = await element.getElementsByClassName("value")
  //   expect(summaryValues[0]?.textContent).toEqual("0.00")
  //   expect(summaryValues[1]?.textContent).toEqual("1,000.00")
  //   expect(summaryValues[2]?.textContent).toEqual("0.00")
  //   expect(summaryValues[3]?.textContent).toEqual("1,000.00")
  // })
})
