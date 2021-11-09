import "@testing-library/jest-dom"
import {mock, resetMocks} from "depay-web3-mock"
import {render, screen, fireEvent} from "@testing-library/react"
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
import {ThemeProvider} from "styled-components"
import {defaultTheme} from "../../styles/theme"

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
      <ThemeProvider theme={defaultTheme}>
        <Router>
          <Rewards />
        </Router>
      </ThemeProvider>
    </AppContext.Provider>
  )
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

describe("Rewards list and detail", () => {
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

  it("shows empty list", async () => {
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

    expect(await screen.getByText("pools")).toBeVisible()
  })

  it("shows staking rewards on rewards list", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, user} = await setupNewStakingReward(
      goldfinchProtocol,
      seniorPool
    )
    renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

    expect(await screen.findByText("Staked 50,000.00 FIDU on Jan 5, 2022")).toBeVisible()
    expect(await screen.findByText("Vesting")).toBeVisible()
    expect((await screen.findAllByText("0.00")).length).toBe(7)

    fireEvent.click(screen.getByText("Staked 50,000.00 FIDU on Jan 5, 2022"))

    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("Vesting schedule")).toBeVisible()
    expect(await screen.findByText("Linear until 100% on Jan 5, 2023")).toBeVisible()

    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("0.00 claimed of your total vested 0.00 GFI")).toBeVisible()

    expect(await screen.findByText("Current earn rate")).toBeVisible()
    expect(await screen.findByText("+453.60 granted per week")).toBeVisible()

    expect(await screen.findByText("Vesting status")).toBeVisible()
    expect(await screen.findByText("--.--% (0.00 GFI) vested")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/address/${stakingRewards.address}`
    )
  })

  it("shows claimable staking rewards on rewards list", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, user} = await setupClaimableStakingReward(
      goldfinchProtocol,
      seniorPool
    )

    renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

    expect(await screen.findByText("Staked 50,000.00 FIDU on Jan 5, 2022")).toBeVisible()
    expect(await screen.findByText("Claim GFI")).toBeVisible()

    const element = screen.getByTestId("rewards-list")
    expect(element.getElementsByClassName("detail-label-value").length).toBe(2)
    const summaryValues = await element.getElementsByClassName("detail-label-value")
    expect(summaryValues[0]?.textContent).toEqual("129.60") // granted
    expect(summaryValues[1]?.textContent).toEqual("0.71") // claimable

    fireEvent.click(screen.getByText("Staked 50,000.00 FIDU on Jan 5, 2022"))

    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("Vesting schedule")).toBeVisible()
    expect(await screen.findByText("Linear until 100% on Jan 5, 2023")).toBeVisible()

    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("0.00 claimed of your total vested 0.71 GFI")).toBeVisible()

    expect(await screen.findByText("Current earn rate")).toBeVisible()
    expect(await screen.findByText("+453.60 granted per week")).toBeVisible()

    expect(await screen.findByText("Vesting status")).toBeVisible()
    expect(await screen.findByText("0.55% (0.71 GFI) vested")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/address/${stakingRewards.address}`
    )
  })

  it("shows claimable community rewards on rewards list", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, user} = await setupClaimableCommunityReward(
      goldfinchProtocol,
      seniorPool
    )

    renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

    expect(await screen.findByText("Flight Academy")).toBeVisible()
    expect(await screen.findByText("Claim GFI")).toBeVisible()

    const element = screen.getByTestId("rewards-list")
    expect(element.getElementsByClassName("detail-label-value").length).toBe(2)
    const summaryValues = await element.getElementsByClassName("detail-label-value")
    expect(summaryValues[0]?.textContent).toEqual("1,000.00") // granted
    expect(summaryValues[1]?.textContent).toEqual("1,000.00") // claimable

    fireEvent.click(screen.getByText("Flight Academy"))

    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(
      await screen.findByText("1,000.00 GFI reward on Jan 7, 2022 for participating in Flight Academy")
    ).toBeVisible()

    expect(await screen.findByText("Vesting status")).toBeVisible()
    expect(await screen.findByText("100.00% (1,000.00 GFI) vested")).toBeVisible()

    expect(await screen.findByText("Vesting schedule")).toBeVisible()
    expect(await screen.findByText("None")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/address/${communityRewards.address}`
    )
  })

  it("shows community rewards on rewards list", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, user} = await setupVestingCommunityReward(
      goldfinchProtocol,
      seniorPool
    )

    renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

    expect(await screen.findByText("Goldfinch Investment")).toBeVisible()
    expect(await screen.findByText("Vesting")).toBeVisible()

    const element = screen.getByTestId("rewards-list")
    expect(element.getElementsByClassName("detail-label-value").length).toBe(2)
    const summaryValues = await element.getElementsByClassName("detail-label-value")
    expect(summaryValues[0]?.textContent).toEqual("1,000.00") // granted
    expect(summaryValues[1]?.textContent).toEqual("0.00") // claimable

    fireEvent.click(screen.getByText("Goldfinch Investment"))

    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(
      await screen.findByText("1,000.00 GFI reward on Jan 7, 2022 for participating as a Goldfinch investor")
    ).toBeVisible()

    expect(await screen.findByText("Vesting status")).toBeVisible()
    expect(await screen.findByText("--.--% (0.00 GFI) vested")).toBeVisible()

    expect(await screen.findByText("Vesting schedule")).toBeVisible()
    expect(await screen.findByText("Linear, vesting every 300 seconds, until 100% on Jan 7, 2022")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/address/${communityRewards.address}`
    )
  })

  it("shows airdrops from merkle distributor", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, user} = await setupAirdrop(
      goldfinchProtocol,
      seniorPool
    )

    renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

    expect(await screen.findByText("Flight Academy")).toBeVisible()
    expect(await screen.findByText("Accept")).toBeVisible()

    const element = screen.getByTestId("rewards-list")
    expect(element.getElementsByClassName("detail-label-value").length).toBe(2)
    const summaryValues = await element.getElementsByClassName("detail-label-value")
    expect(summaryValues[0]?.textContent).toEqual("1,000.00") // granted
    expect(summaryValues[1]?.textContent).toEqual("0.00") // claimable

    fireEvent.click(screen.getByText("Flight Academy"))

    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("1,000.00 GFI reward for participating in Flight Academy")).toBeVisible()

    expect(await screen.findByText("Vesting status")).toBeVisible()
    expect(await screen.findByText("$--.-- ( GFI) vested")).toBeVisible()

    expect(await screen.findByText("Vesting schedule")).toBeVisible()
    expect(await screen.findByText("None")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/address/${merkleDistributor.address}`
    )
  })

  it("shows community rewards and staking rewards ", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, user} = await setupCommunityRewardAndStakingReward(
      goldfinchProtocol,
      seniorPool
    )

    renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

    expect(await screen.findByText("Staked 50,000.00 FIDU on Jan 5, 2022")).toBeVisible()
    expect(await screen.findByText("Flight Academy")).toBeVisible()
    expect(await screen.getAllByText("Claim GFI").length).toBe(2)

    const element = screen.getByTestId("rewards-list")
    expect(element.getElementsByClassName("detail-label-value").length).toBe(4)
    const summaryValues = await element.getElementsByClassName("detail-label-value")
    expect(summaryValues[0]?.textContent).toEqual("1,000.00") // granted
    expect(summaryValues[1]?.textContent).toEqual("1,000.00") // claimable
    expect(summaryValues[2]?.textContent).toEqual("129.60") // granted
    expect(summaryValues[3]?.textContent).toEqual("0.71") // claimable

    fireEvent.click(screen.getByText("Staked 50,000.00 FIDU on Jan 5, 2022"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("Vesting schedule")).toBeVisible()
    expect(await screen.findByText("Linear until 100% on Jan 5, 2023")).toBeVisible()

    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("0.00 claimed of your total vested 0.71 GFI")).toBeVisible()

    expect(await screen.findByText("Current earn rate")).toBeVisible()
    expect(await screen.findByText("+453.60 granted per week")).toBeVisible()

    expect(await screen.findByText("Vesting status")).toBeVisible()
    expect(await screen.findByText("0.55% (0.71 GFI) vested")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/address/${stakingRewards.address}`
    )
    fireEvent.click(screen.getAllByText("Staked 50,000.00 FIDU on Jan 5, 2022")[1])

    fireEvent.click(screen.getByText("Flight Academy"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(
      await screen.findByText("1,000.00 GFI reward on Jan 7, 2022 for participating in Flight Academy")
    ).toBeVisible()

    expect(await screen.findByText("Vesting status")).toBeVisible()
    expect(await screen.findByText("100.00% (1,000.00 GFI) vested")).toBeVisible()

    expect(await screen.findByText("Vesting schedule")).toBeVisible()
    expect(await screen.findByText("None")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/address/${communityRewards.address}`
    )
  })

  it("staking rewards partially claimed appears on list", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, user} = await setupPartiallyClaimedStakingReward(
      goldfinchProtocol,
      seniorPool
    )

    renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

    expect(await screen.findByText("Staked 50,000.00 FIDU on Jan 5, 2022")).toBeVisible()
    expect(await screen.findByText("Claim GFI")).toBeVisible()

    const element = screen.getByTestId("rewards-list")
    expect(element.getElementsByClassName("detail-label-value").length).toBe(2)
    const summaryValues = await element.getElementsByClassName("detail-label-value")
    expect(summaryValues[0]?.textContent).toEqual("269.00") // granted
    expect(summaryValues[1]?.textContent).toEqual("2.24") // claimable

    fireEvent.click(screen.getByText("Staked 50,000.00 FIDU on Jan 5, 2022"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("Vesting schedule")).toBeVisible()
    expect(await screen.findByText("Linear until 100% on Jan 5, 2023")).toBeVisible()

    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("0.82 claimed of your total vested 3.06 GFI")).toBeVisible()

    expect(await screen.findByText("Current earn rate")).toBeVisible()
    expect(await screen.findByText("+453.60 granted per week")).toBeVisible()

    expect(await screen.findByText("Vesting status")).toBeVisible()
    expect(await screen.findByText("1.14% (3.06 GFI) vested")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/address/${stakingRewards.address}`
    )
  })
})
