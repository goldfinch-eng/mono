import "@testing-library/jest-dom"
import {mock, resetMocks} from "depay-web3-mock"
import {render, screen} from "@testing-library/react"
import {BrowserRouter as Router} from "react-router-dom"
import {AppContext} from "../../App"
import web3 from "../../web3"
import Rewards from "../../pages/rewards"
import {MerkleDistributorLoaded, CommunityRewardsLoaded} from "../../ethereum/communityRewards"
import {GFILoaded} from "../../ethereum/gfi"
import {User} from "../../ethereum/user"
import {SeniorPool, StakingRewardsLoaded} from "../../ethereum/pool"
import {UserLoaded} from "../../ethereum/user"
import {blockchain, blockInfo, DEPLOYMENTS, network, recipient} from "./__utils__/constants"
import {assertWithLoadedInfo} from "../../types/loadable"
import {GoldfinchProtocol} from "../../ethereum/GoldfinchProtocol"
import * as utils from "../../ethereum/utils"
import {
  mockUserInitializationContractCalls,
  setupMocksForAcceptedAirdrop,
  assertAllMocksAreCalled,
} from "./__utils__/mocks"
import {
  getDefaultClasses,
  setupNewStakingReward,
  setupClaimableStakingReward,
  setupClaimableCommunityReward,
  setupAirdrop,
  setupCommunityRewardAndStakingReward,
  setupVestingCommunityReward,
  setupPartiallyClaimedStakingReward,
} from "./__utils__/scenarios"

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

describe("Rewards summary overview", () => {
  let seniorPool
  let goldfinchProtocol = new GoldfinchProtocol(network)

  beforeEach(resetMocks)
  beforeEach(() => mock({blockchain, accounts: {return: [recipient]}}))
  beforeEach(async () => {
    jest.spyOn(utils, "getDeployments").mockImplementation(() => {
      return DEPLOYMENTS
    })
    setupMocksForAcceptedAirdrop(undefined) // reset

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

  it("unvested staking reward dont appear on portfolio", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, user} = await setupNewStakingReward(
      goldfinchProtocol,
      seniorPool
    )

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

  it("claimable staking reward appears on portfolio", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, user} = await setupClaimableStakingReward(
      goldfinchProtocol,
      seniorPool
    )

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

  it("community reward appear on portfolio", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, user} = await setupClaimableCommunityReward(
      goldfinchProtocol,
      seniorPool
    )
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

  it("non accepted airdrops dont appear on portfolio", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, user} = await setupAirdrop(
      goldfinchProtocol,
      seniorPool
    )

    renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

    expect(await screen.findByText("Total GFI balance")).toBeVisible()
    expect(await screen.findByText("Wallet balance")).toBeVisible()
    expect(await screen.findByText("Claimable")).toBeVisible()
    expect(await screen.findByText("Still vesting")).toBeVisible()
    const element = screen.getByTestId("rewards-summary")
    expect(element.getElementsByClassName("disabled-value").length).toBe(4)
  })

  it("community reward and staking reward appear on portfolio", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, user} = await setupCommunityRewardAndStakingReward(
      goldfinchProtocol,
      seniorPool
    )

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

  it("vesting community reward appear on portfolio", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, user} = await setupVestingCommunityReward(
      goldfinchProtocol,
      seniorPool
    )
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

  it("staking reward partially claimed appear on portfolio", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, user} = await setupPartiallyClaimedStakingReward(
      goldfinchProtocol,
      seniorPool
    )

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
