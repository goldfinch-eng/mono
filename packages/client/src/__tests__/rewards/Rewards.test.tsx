import {CreditDesk} from "@goldfinch-eng/protocol/typechain/web3/CreditDesk"
import "@testing-library/jest-dom"
import {mock, resetMocks} from "depay-web3-mock"
import {render, screen, fireEvent} from "@testing-library/react"
import {BrowserRouter as Router} from "react-router-dom"
import {AppContext} from "../../App"
import {CommunityRewardsLoaded, MerkleDistributorLoaded} from "../../ethereum/communityRewards"
import {GFILoaded} from "../../ethereum/gfi"
import {GoldfinchProtocol} from "../../ethereum/GoldfinchProtocol"
import {PoolData, SeniorPool, SeniorPoolLoaded, StakingRewardsLoaded} from "../../ethereum/pool"
import {User, UserLoaded} from "../../ethereum/user"
import * as utils from "../../ethereum/utils"
import Rewards from "../../pages/rewards"
import {assertWithLoadedInfo} from "../../types/loadable"
import web3 from "../../web3"
import {blockchain, blockInfo, DEPLOYMENTS, network, recipient} from "./__utils__/constants"
import {
  assertAllMocksAreCalled,
  mockUserInitializationContractCalls,
  RewardsMockData,
  setupMocksForAirdrop,
} from "./__utils__/mocks"
import {
  getDefaultClasses,
  setupAirdrop,
  setupClaimableCommunityReward,
  setupClaimableStakingReward,
  setupCommunityRewardAndStakingReward,
  setupNewStakingReward,
  setupPartiallyClaimedStakingReward,
  setupVestingCommunityReward,
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

async function getUserLoaded(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPoolLoaded: SeniorPoolLoaded,
  stakingRewards: StakingRewardsLoaded,
  gfi: GFILoaded,
  communityRewards: CommunityRewardsLoaded,
  merkleDistributor: MerkleDistributorLoaded,
  rewardsMock?: RewardsMockData
): Promise<UserLoaded> {
  const user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
  const mocks = mockUserInitializationContractCalls(user, stakingRewards, gfi, communityRewards, rewardsMock)

  await user.initialize(seniorPoolLoaded, stakingRewards, gfi, communityRewards, merkleDistributor, blockInfo)
  assertAllMocksAreCalled(mocks)
  assertWithLoadedInfo(user)
  return user
}

describe("Rewards portfolio overview", () => {
  let seniorPoolLoaded: SeniorPoolLoaded
  let goldfinchProtocol = new GoldfinchProtocol(network)

  beforeEach(resetMocks)
  beforeEach(() => mock({blockchain, accounts: {return: [recipient]}}))
  beforeEach(async () => {
    jest.spyOn(utils, "getDeployments").mockImplementation(() => {
      return Promise.resolve(DEPLOYMENTS)
    })
    setupMocksForAirdrop(undefined) // reset

    await goldfinchProtocol.initialize()
    const _seniorPoolLoaded = new SeniorPool(goldfinchProtocol)
    _seniorPoolLoaded.info = {
      loaded: true,
      value: {
        currentBlock: blockInfo,
        poolData: {} as PoolData,
        isPaused: false,
      },
    }
    assertWithLoadedInfo(_seniorPoolLoaded)
    seniorPoolLoaded = _seniorPoolLoaded
  })

  describe("loading state", () => {
    it("shows loading message when all requirements are empty", async () => {
      renderRewards(undefined, undefined, undefined, undefined, undefined)
      expect(await screen.findByText("Loading...")).toBeVisible()
    })

    it("shows loading message when all but one requirement are empty", async () => {
      const {stakingRewards} = await getDefaultClasses(goldfinchProtocol)
      renderRewards(stakingRewards, undefined, undefined, undefined, undefined)
      expect(await screen.findByText("Loading...")).toBeVisible()
    })
    it("shows loading message when all but two requirements are empty", async () => {
      const {stakingRewards, gfi} = await getDefaultClasses(goldfinchProtocol)
      renderRewards(stakingRewards, gfi, undefined, undefined, undefined)
      expect(await screen.findByText("Loading...")).toBeVisible()
    })
    it("shows loading message when all but three requirements are empty", async () => {
      const {stakingRewards, gfi, merkleDistributor, communityRewards} = await getDefaultClasses(goldfinchProtocol)
      const user = await getUserLoaded(
        goldfinchProtocol,
        seniorPoolLoaded,
        stakingRewards,
        gfi,
        communityRewards,
        merkleDistributor
      )
      renderRewards(stakingRewards, gfi, user, undefined, undefined)
      expect(await screen.findByText("Loading...")).toBeVisible()
    })
    it("shows loading message when all but four requirements are empty", async () => {
      const {stakingRewards, gfi, merkleDistributor, communityRewards} = await getDefaultClasses(goldfinchProtocol)
      const user = await getUserLoaded(
        goldfinchProtocol,
        seniorPoolLoaded,
        stakingRewards,
        gfi,
        communityRewards,
        merkleDistributor
      )
      renderRewards(stakingRewards, gfi, user, merkleDistributor, undefined)
      expect(await screen.findByText("Loading...")).toBeVisible()
    })

    it("doesn't show loading message when all requirements are loaded", async () => {
      const {gfi, stakingRewards, communityRewards, merkleDistributor} = await getDefaultClasses(goldfinchProtocol)
      const user = await getUserLoaded(
        goldfinchProtocol,
        seniorPoolLoaded,
        stakingRewards,
        gfi,
        communityRewards,
        merkleDistributor
      )
      renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

      expect(await screen.queryByText("Loading...")).not.toBeInTheDocument()
    })
  })

  describe("claimable amount is 0", () => {
    it("shows empty portfolio", async () => {
      const {gfi, stakingRewards, communityRewards, merkleDistributor} = await getDefaultClasses(goldfinchProtocol)
      const user = await getUserLoaded(
        goldfinchProtocol,
        seniorPoolLoaded,
        stakingRewards,
        gfi,
        communityRewards,
        merkleDistributor
      )
      renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

      expect(await screen.findByText("Total GFI balance")).toBeVisible()
      expect(await screen.findByText("Wallet balance")).toBeVisible()
      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Still vesting")).toBeVisible()

      expect(await screen.getByTestId("summary-wallet-balance").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("0.00")
    })

    it("shows wallet balance on portfolio", async () => {
      const {gfi, stakingRewards, communityRewards, merkleDistributor} = await getDefaultClasses(goldfinchProtocol)
      const user = await getUserLoaded(
        goldfinchProtocol,
        seniorPoolLoaded,
        stakingRewards,
        gfi,
        communityRewards,
        merkleDistributor,
        {gfi: {gfiBalance: "1000000000000000000"}}
      )
      renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

      expect(await screen.findByText("Total GFI balance")).toBeVisible()
      expect(await screen.findByText("Wallet balance")).toBeVisible()
      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Still vesting")).toBeVisible()

      expect(await screen.getByTestId("summary-wallet-balance").textContent).toEqual("1.00")
      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("1.00")
    })
    it("staking reward before checkpoint (but still vesting) don't appear on portfolio", async () => {
      const {gfi, stakingRewards, communityRewards, merkleDistributor, user} = await setupNewStakingReward(
        goldfinchProtocol,
        seniorPoolLoaded
      )

      renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

      expect(await screen.findByText("Total GFI balance")).toBeVisible()
      expect(await screen.findByText("Wallet balance")).toBeVisible()
      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Still vesting")).toBeVisible()

      expect(await screen.getByTestId("summary-wallet-balance").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("0.00")

      expect(await screen.getByTestId("summary-wallet-balance").className).toEqual("disabled-value")
      expect(await screen.getByTestId("summary-claimable").className).toEqual("disabled-value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("disabled-value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("disabled-value")
    })

    it("non accepted airdrops don't appear on portfolio", async () => {
      const {gfi, stakingRewards, communityRewards, merkleDistributor, user} = await setupAirdrop(
        goldfinchProtocol,
        seniorPoolLoaded
      )

      renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

      expect(await screen.findByText("Total GFI balance")).toBeVisible()
      expect(await screen.findByText("Wallet balance")).toBeVisible()
      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Still vesting")).toBeVisible()

      expect(await screen.getByTestId("summary-wallet-balance").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("0.00")

      expect(await screen.getByTestId("summary-wallet-balance").className).toEqual("disabled-value")
      expect(await screen.getByTestId("summary-claimable").className).toEqual("disabled-value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("disabled-value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("disabled-value")
    })

    it("vesting community reward appears on portfolio", async () => {
      const {gfi, stakingRewards, communityRewards, merkleDistributor, user} = await setupVestingCommunityReward(
        goldfinchProtocol,
        seniorPoolLoaded
      )
      renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

      expect(await screen.findByText("Wallet balance")).toBeVisible()
      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Still vesting")).toBeVisible()
      expect(await screen.findByText("Total GFI balance")).toBeVisible()

      expect(await screen.getByTestId("summary-wallet-balance").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("1,000.00")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("1,000.00")

      expect(await screen.getByTestId("summary-wallet-balance").className).toEqual("value")
      expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
    })
  })

  describe("claimable amount > 0", () => {
    it("claimable staking reward appears on portfolio", async () => {
      const {gfi, stakingRewards, communityRewards, merkleDistributor, user} = await setupClaimableStakingReward(
        goldfinchProtocol,
        seniorPoolLoaded
      )

      renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

      expect(await screen.findByText("Total GFI balance")).toBeVisible()
      expect(await screen.findByText("Wallet balance")).toBeVisible()
      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Still vesting")).toBeVisible()

      expect(await screen.getByTestId("summary-wallet-balance").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("0.71")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("128.89")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("129.60")

      expect(await screen.getByTestId("summary-wallet-balance").className).toEqual("value")
      expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
    })

    it("community reward without vesting appears on portfolio", async () => {
      const {gfi, stakingRewards, communityRewards, merkleDistributor, user} = await setupClaimableCommunityReward(
        goldfinchProtocol,
        seniorPoolLoaded
      )
      renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

      expect(await screen.findByText("Wallet balance")).toBeVisible()
      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Still vesting")).toBeVisible()
      expect(await screen.findByText("Total GFI balance")).toBeVisible()

      expect(await screen.getByTestId("summary-wallet-balance").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("1,000.00")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("1,000.00")

      expect(await screen.getByTestId("summary-wallet-balance").className).toEqual("value")
      expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
    })

    it("community reward and staking reward appear on portfolio", async () => {
      const {gfi, stakingRewards, communityRewards, merkleDistributor, user} =
        await setupCommunityRewardAndStakingReward(goldfinchProtocol, seniorPoolLoaded)

      renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

      expect(await screen.findByText("Total GFI balance")).toBeVisible()
      expect(await screen.findByText("Wallet balance")).toBeVisible()
      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Still vesting")).toBeVisible()

      expect(await screen.getByTestId("summary-wallet-balance").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("1,000.71")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("128.89")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("1,129.60")

      expect(await screen.getByTestId("summary-wallet-balance").className).toEqual("value")
      expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
    })

    it("staking reward partially claimed (but with 0 wallet balance) appears on portfolio", async () => {
      const {gfi, stakingRewards, communityRewards, merkleDistributor, user} = await setupPartiallyClaimedStakingReward(
        goldfinchProtocol,
        seniorPoolLoaded
      )

      renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

      expect(await screen.findByText("Wallet balance")).toBeVisible()
      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Still vesting")).toBeVisible()
      expect(await screen.findByText("Total GFI balance")).toBeVisible()

      expect(await screen.getByTestId("summary-wallet-balance").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("2.24")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("265.94")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("268.18")

      expect(await screen.getByTestId("summary-wallet-balance").className).toEqual("value")
      expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
    })

    it("staking reward partially claimed (but with wallet balance) appears on portfolio", async () => {
      const {gfi, stakingRewards, communityRewards, merkleDistributor, user} = await setupPartiallyClaimedStakingReward(
        goldfinchProtocol,
        seniorPoolLoaded,
        "1000000000000000000"
      )

      renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

      expect(await screen.findByText("Wallet balance")).toBeVisible()
      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Still vesting")).toBeVisible()
      expect(await screen.findByText("Total GFI balance")).toBeVisible()

      expect(await screen.getByTestId("summary-wallet-balance").textContent).toEqual("1.00")
      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("2.24")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("265.94")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("269.18")

      expect(await screen.getByTestId("summary-wallet-balance").className).toEqual("value")
      expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
    })
  })
})

describe("Rewards list and detail", () => {
  let seniorPool: SeniorPoolLoaded
  let goldfinchProtocol = new GoldfinchProtocol(network)

  beforeEach(resetMocks)
  beforeEach(() => mock({blockchain, accounts: {return: [recipient]}}))
  beforeEach(async () => {
    jest.spyOn(utils, "getDeployments").mockImplementation(() => {
      return Promise.resolve(DEPLOYMENTS)
    })
    setupMocksForAirdrop(undefined) // reset

    await goldfinchProtocol.initialize()
    const _seniorPoolLoaded = new SeniorPool(goldfinchProtocol)
    _seniorPoolLoaded.info = {
      loaded: true,
      value: {
        currentBlock: blockInfo,
        // @ts-ignore
        poolData: {},
        isPaused: false,
      },
    }
    assertWithLoadedInfo(_seniorPoolLoaded)
    seniorPool = _seniorPoolLoaded
  })

  it("shows empty list", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor} = await getDefaultClasses(goldfinchProtocol)

    const user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
    const mocks = mockUserInitializationContractCalls(user, stakingRewards, gfi, communityRewards, {})
    await user.initialize(seniorPool, stakingRewards, gfi, communityRewards, merkleDistributor, blockInfo)
    assertAllMocksAreCalled(mocks)
    assertWithLoadedInfo(user)

    const {container} = renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

    const list = container.getElementsByClassName("rewards-list-item")
    expect(list.length).toEqual(1)
    expect(list[0]?.textContent).toContain("You have no rewards. You can earn rewards by supplying")
  })

  it("shows staking rewards on rewards list", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, user} = await setupNewStakingReward(
      goldfinchProtocol,
      seniorPool
    )
    renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

    expect(await screen.findByText("Staked 50K FIDU on Jan 5")).toBeVisible()
    expect(await screen.findByText("Vesting")).toBeVisible()
    expect((await screen.findAllByText("0.00")).length).toBe(7)

    fireEvent.click(screen.getByText("Staked 50K FIDU on Jan 5"))

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

    expect(await screen.findByText("Staked 50K FIDU on Jan 5")).toBeVisible()
    expect(await screen.findByText("Claim GFI")).toBeVisible()

    expect(screen.getByTestId("detail-granted").textContent).toEqual("129.60")
    expect(screen.getByTestId("detail-claimable").textContent).toEqual("0.71")

    fireEvent.click(screen.getByText("Staked 50K FIDU on Jan 5"))

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

    expect(screen.getByTestId("detail-granted").textContent).toEqual("1,000.00")
    expect(screen.getByTestId("detail-claimable").textContent).toEqual("1,000.00")

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

    expect(screen.getByTestId("detail-granted").textContent).toEqual("1,000.00")
    expect(screen.getByTestId("detail-claimable").textContent).toEqual("0.00")

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

    expect(screen.getByTestId("detail-granted").textContent).toEqual("1,000.00")
    expect(screen.getByTestId("detail-claimable").textContent).toEqual("0.00")

    fireEvent.click(screen.getByText("Flight Academy"))

    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("1,000.00 GFI reward for participating in Flight Academy")).toBeVisible()

    expect(await screen.findByText("Vesting status")).toBeVisible()
    expect(await screen.findByText("$--.-- (0.00 GFI) vested")).toBeVisible()

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

    expect(await screen.findByText("Staked 50K FIDU on Jan 5")).toBeVisible()
    expect(await screen.findByText("Flight Academy")).toBeVisible()
    expect(await screen.getAllByText("Claim GFI").length).toBe(2)

    expect(screen.getAllByTestId("detail-granted")[0]?.textContent).toEqual("1,000.00")
    expect(screen.getAllByTestId("detail-claimable")[0]?.textContent).toEqual("1,000.00")
    expect(screen.getAllByTestId("detail-granted")[1]?.textContent).toEqual("129.60")
    expect(screen.getAllByTestId("detail-claimable")[1]?.textContent).toEqual("0.71")

    fireEvent.click(screen.getByText("Staked 50K FIDU on Jan 5"))
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
    fireEvent.click(screen.getByText("Staked 50K FIDU on Jan 5"))

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

    expect(await screen.findByText("Staked 50K FIDU on Jan 5")).toBeVisible()
    expect(await screen.findByText("Claim GFI")).toBeVisible()

    expect(screen.getByTestId("detail-granted").textContent).toEqual("269.00")
    expect(screen.getByTestId("detail-claimable").textContent).toEqual("2.24")

    fireEvent.click(screen.getByText("Staked 50K FIDU on Jan 5"))
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
