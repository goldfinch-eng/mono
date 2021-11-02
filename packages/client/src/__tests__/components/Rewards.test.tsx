import "@testing-library/jest-dom"
import {mock, resetMocks} from "depay-web3-mock"
import {render, screen} from "@testing-library/react"
import {MerkleDistributorGrantInfo} from "@goldfinch-eng/protocol/blockchain_scripts/merkleDistributor/types"
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
import {blockchain, blockInfo, DEPLOYMENTS, network, recipient} from "../constants"
import {assertWithLoadedInfo} from "../../types/loadable"
import {GoldfinchProtocol} from "../../ethereum/GoldfinchProtocol"
import * as utils from "../../ethereum/utils"
import {
  mockStakingRewardsContractCalls,
  mockMerkleDistributorContractCalls,
  mockUserInitializationContractCalls,
  setupMocksForAcceptedAirdrop,
  assertAllMocksAreCalled,
} from "../mocks"

mock({
  blockchain: "ethereum",
})

web3.setProvider(global.ethereum)

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
    const mocks = mockUserInitializationContractCalls(user, stakingRewards, gfi, communityRewards, {
      hasStakingRewards: false,
      hasCommunityRewards: false,
    })
    await user.initialize(seniorPool, stakingRewards, gfi, communityRewards, merkleDistributor, blockInfo)
    assertAllMocksAreCalled(mocks)
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
    const mocks = mockUserInitializationContractCalls(user, stakingRewards, gfi, communityRewards, {
      hasStakingRewards: true,
      hasCommunityRewards: false,
    })
    await user.initialize(seniorPool, stakingRewards, gfi, communityRewards, merkleDistributor, blockInfo)

    assertWithLoadedInfo(user)
    assertAllMocksAreCalled(mocks)

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

  it("vesting staking rewards appears on portfolio", async () => {
    const updatedBlockInfo = {...blockInfo}
    updatedBlockInfo.timestamp = 1641564707

    const {gfi, stakingRewards, communityRewards, merkleDistributor} = await getDefaultClasses(goldfinchProtocol)
    const user = new User(recipient, network.name, undefined, goldfinchProtocol, undefined)
    const mocks = mockUserInitializationContractCalls(user, stakingRewards, gfi, communityRewards, {
      hasStakingRewards: true,
      hasCommunityRewards: false,
      currentTimestamp: String(updatedBlockInfo.timestamp),
      earnedSince: "129600000000000000000",
      totalVestedAt: "710136986301369863",
    })
    await user.initialize(seniorPool, stakingRewards, gfi, communityRewards, merkleDistributor, updatedBlockInfo)

    assertWithLoadedInfo(user)
    assertAllMocksAreCalled(mocks)

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

  it("shows community rewards on portfolio", async () => {
    const airdrop = {
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
    setupMocksForAcceptedAirdrop(airdrop)

    const {gfi, stakingRewards, communityRewards, merkleDistributor} = await getDefaultClasses(goldfinchProtocol)
    const user = new User(recipient, network.name, undefined, goldfinchProtocol, undefined)
    const mocks = mockUserInitializationContractCalls(user, stakingRewards, gfi, communityRewards, {
      hasStakingRewards: false,
      hasCommunityRewards: true,
      airdrop: airdrop as MerkleDistributorGrantInfo,
    })
    await user.initialize(seniorPool, stakingRewards, gfi, communityRewards, merkleDistributor, blockInfo)

    assertWithLoadedInfo(user)
    assertAllMocksAreCalled(mocks)

    renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

    expect(await screen.findByText("Wallet balance")).toBeVisible()
    expect(await screen.findByText("Claimable")).toBeVisible()
    expect(await screen.findByText("Still vesting")).toBeVisible()
    expect(await screen.findByText("Total GFI balance")).toBeVisible()

    const element = screen.getByTestId("rewards-summary")
    expect(element.getElementsByClassName("value").length).toBe(4)
    const summaryValues = await element.getElementsByClassName("value")
    expect(summaryValues[0]?.textContent).toEqual("0.00")
    expect(summaryValues[1]?.textContent).toEqual("1,000.00")
    expect(summaryValues[2]?.textContent).toEqual("0.00")
    expect(summaryValues[3]?.textContent).toEqual("1,000.00")
  })

  it("non accepted airdrops dont count for portfolio", async () => {
    const airdrop = {
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
    setupMocksForAcceptedAirdrop(airdrop, false)
    const {gfi, stakingRewards, communityRewards, merkleDistributor} = await getDefaultClasses(goldfinchProtocol)
    const user = new User(recipient, network.name, undefined, goldfinchProtocol, undefined)
    const mocks = mockUserInitializationContractCalls(user, stakingRewards, gfi, communityRewards, {
      hasStakingRewards: false,
      hasCommunityRewards: false,
    })
    await user.initialize(seniorPool, stakingRewards, gfi, communityRewards, merkleDistributor, blockInfo)

    assertWithLoadedInfo(user)
    assertAllMocksAreCalled(mocks)

    renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

    expect(await screen.findByText("Total GFI balance")).toBeVisible()
    expect(await screen.findByText("Wallet balance")).toBeVisible()
    expect(await screen.findByText("Claimable")).toBeVisible()
    expect(await screen.findByText("Still vesting")).toBeVisible()
    const element = screen.getByTestId("rewards-summary")
    expect(element.getElementsByClassName("disabled-value").length).toBe(4)
  })

  it("shows community rewards and staking rewards on portfolio", async () => {
    const updatedBlockInfo = {...blockInfo}
    updatedBlockInfo.timestamp = 1641564707

    const airdrop = {
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
    setupMocksForAcceptedAirdrop(airdrop)

    const {gfi, stakingRewards, communityRewards, merkleDistributor} = await getDefaultClasses(goldfinchProtocol)
    const user = new User(recipient, network.name, undefined, goldfinchProtocol, undefined)
    const mocks = mockUserInitializationContractCalls(user, stakingRewards, gfi, communityRewards, {
      hasStakingRewards: true,
      hasCommunityRewards: true,
      currentTimestamp: String(updatedBlockInfo.timestamp),
      earnedSince: "129600000000000000000",
      totalVestedAt: "710136986301369863",
      airdrop: airdrop as MerkleDistributorGrantInfo,
    })
    await user.initialize(seniorPool, stakingRewards, gfi, communityRewards, merkleDistributor, updatedBlockInfo)

    assertWithLoadedInfo(user)
    assertAllMocksAreCalled(mocks)

    renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

    expect(await screen.findByText("Total GFI balance")).toBeVisible()
    expect(await screen.findByText("Wallet balance")).toBeVisible()
    expect(await screen.findByText("Claimable")).toBeVisible()
    expect(await screen.findByText("Still vesting")).toBeVisible()

    const element = screen.getByTestId("rewards-summary")
    expect(element.getElementsByClassName("value").length).toBe(4)
    const summaryValues = await element.getElementsByClassName("value")
    expect(summaryValues[0]?.textContent).toEqual("0.00")
    expect(summaryValues[1]?.textContent).toEqual("1,000.71")
    expect(summaryValues[2]?.textContent).toEqual("128.89")
    expect(summaryValues[3]?.textContent).toEqual("1,129.60")
  })

  it("vesting community rewards appears on portfolio", async () => {
    const airdrop = {
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
    setupMocksForAcceptedAirdrop(airdrop)

    const {gfi, stakingRewards, communityRewards, merkleDistributor} = await getDefaultClasses(goldfinchProtocol)
    const user = new User(recipient, network.name, undefined, goldfinchProtocol, undefined)
    const mocks = mockUserInitializationContractCalls(user, stakingRewards, gfi, communityRewards, {
      hasStakingRewards: false,
      hasCommunityRewards: true,
      airdrop: airdrop as MerkleDistributorGrantInfo,
      grantRes: ["1000000000000000000000", "0", "1641576557", "1641582557", "0", "300", "0"],
      claimable: "0",
    })
    await user.initialize(seniorPool, stakingRewards, gfi, communityRewards, merkleDistributor, blockInfo)

    assertWithLoadedInfo(user)
    assertAllMocksAreCalled(mocks)

    renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

    expect(await screen.findByText("Wallet balance")).toBeVisible()
    expect(await screen.findByText("Claimable")).toBeVisible()
    expect(await screen.findByText("Still vesting")).toBeVisible()
    expect(await screen.findByText("Total GFI balance")).toBeVisible()

    const element = screen.getByTestId("rewards-summary")
    expect(element.getElementsByClassName("value").length).toBe(4)
    const summaryValues = await element.getElementsByClassName("value")
    expect(summaryValues[0]?.textContent).toEqual("0.00")
    expect(summaryValues[1]?.textContent).toEqual("0.00")
    expect(summaryValues[2]?.textContent).toEqual("1,000.00")
    expect(summaryValues[3]?.textContent).toEqual("1,000.00")
  })

  it("staking rewards partially claimed appears on portfolio", async () => {
    const updatedBlockInfo = {...blockInfo}
    updatedBlockInfo.timestamp = 1641750579

    const {gfi, stakingRewards, communityRewards, merkleDistributor} = await getDefaultClasses(goldfinchProtocol)
    const user = new User(recipient, network.name, undefined, goldfinchProtocol, undefined)
    const mocks = mockUserInitializationContractCalls(user, stakingRewards, gfi, communityRewards, {
      hasStakingRewards: true,
      hasCommunityRewards: false,
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
    })
    await user.initialize(seniorPool, stakingRewards, gfi, communityRewards, merkleDistributor, updatedBlockInfo)

    assertWithLoadedInfo(user)
    assertAllMocksAreCalled(mocks)

    renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

    expect(await screen.findByText("Wallet balance")).toBeVisible()
    expect(await screen.findByText("Claimable")).toBeVisible()
    expect(await screen.findByText("Still vesting")).toBeVisible()
    expect(await screen.findByText("Total GFI balance")).toBeVisible()

    const element = screen.getByTestId("rewards-summary")
    expect(element.getElementsByClassName("value").length).toBe(4)
    const summaryValues = await element.getElementsByClassName("value")
    expect(summaryValues[0]?.textContent).toEqual("0.00")
    expect(summaryValues[1]?.textContent).toEqual("2.24")
    expect(summaryValues[2]?.textContent).toEqual("265.94")
    expect(summaryValues[3]?.textContent).toEqual("269.00")
  })
})
