import "@testing-library/jest-dom"
import {render, screen, fireEvent, waitFor} from "@testing-library/react"
import {CreditDesk} from "@goldfinch-eng/protocol/typechain/web3/CreditDesk"
import {mock} from "depay-web3-mock"
import {BigNumber} from "bignumber.js"
import {BrowserRouter as Router} from "react-router-dom"
import {AppContext} from "../../App"
import web3 from "../../web3"
import {CapitalProvider, fetchCapitalProviderData, SeniorPool, StakingRewardsLoaded} from "../../ethereum/pool"
import {User, UserLoaded} from "../../ethereum/user"
import {blockchain, blockInfo, DEPLOYMENTS, network, recipient, stakingRewardsABI} from "../rewards/__utils__/constants"
import {GoldfinchProtocol} from "../../ethereum/GoldfinchProtocol"
import {
  getDefaultClasses,
  setupClaimableStakingReward,
  setupPartiallyClaimedStakingReward,
} from "../rewards/__utils__/scenarios"
import {assertWithLoadedInfo, Loaded} from "../../types/loadable"
import {
  mockCapitalProviderCalls,
  mockUserInitializationContractCalls,
  setupMocksForAirdrop,
} from "../rewards/__utils__/mocks"
import WithdrawalForm from "../../components/withdrawalForm"
import {usdcToAtomic} from "../../ethereum/erc20"
import * as utils from "../../ethereum/utils"

mock({
  blockchain: "ethereum",
})

web3.setProvider(global.ethereum)

function renderWithdrawalForm(
  poolData,
  capitalProvider: Loaded<CapitalProvider>,
  stakingRewards?: StakingRewardsLoaded | undefined,
  pool?: SeniorPool | undefined,
  refreshCurrentBlock?: unknown,
  networkMonitor?: unknown,
  user?: UserLoaded | undefined
) {
  const store = {
    goldfinchConfig: {
      transactionLimit: new BigNumber(usdcToAtomic("20000")),
    },
    stakingRewards,
    pool,
    user,
    refreshCurrentBlock,
    networkMonitor,
  }

  return render(
    <AppContext.Provider value={store}>
      <Router>
        <WithdrawalForm
          poolData={poolData}
          capitalProvider={capitalProvider.value}
          actionComplete={() => {}}
          closeForm={() => {}}
        />
      </Router>
    </AppContext.Provider>
  )
}

describe("Earn page portfolio overview", () => {
  let seniorPool
  let goldfinchProtocol = new GoldfinchProtocol(network)
  let gfi, stakingRewards, communityRewards, merkleDistributor, user, capitalProvider

  beforeEach(async () => {
    jest.spyOn(utils, "getDeployments").mockImplementation(() => {
      return DEPLOYMENTS
    })
    setupMocksForAirdrop(undefined) // reset

    await goldfinchProtocol.initialize()
    seniorPool = new SeniorPool(goldfinchProtocol)
    seniorPool.info = {
      loaded: true,
      value: {
        currentBlock: blockInfo,
        poolData: {
          estimatedApy: new BigNumber("0.00483856000534281158"),
        },
        isPaused: false,
      },
    }
  })
  beforeEach(async () => {
    const result = await getDefaultClasses(goldfinchProtocol)
    gfi = result.gfi
    stakingRewards = result.stakingRewards
    communityRewards = result.communityRewards
    merkleDistributor = result.merkleDistributor

    const user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
    mockUserInitializationContractCalls(user, stakingRewards, gfi, communityRewards, {})
    await user.initialize(seniorPool, stakingRewards, gfi, communityRewards, merkleDistributor, blockInfo)

    assertWithLoadedInfo(user)
    assertWithLoadedInfo(seniorPool)

    mockCapitalProviderCalls()
    capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it("shows withdrawal form", async () => {
    const poolData = {
      balance: new BigNumber(usdcToAtomic("50000000")),
      loaded: true,
    }
    renderWithdrawalForm(poolData, capitalProvider)

    expect(await screen.findByText("Available to withdraw: $50.02")).toBeVisible()
    expect(await screen.findByText("Max")).toBeVisible()
    expect(await screen.findByText("Submit")).toBeVisible()
    expect(await screen.findByText("Cancel")).toBeVisible()
    expect(await screen.findByText("Withdraw")).toBeVisible()
  })

  it("show withdrawal form with claimable staking reward", async () => {
    const {user} = await setupClaimableStakingReward(goldfinchProtocol, seniorPool)

    mockCapitalProviderCalls()
    const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)

    const poolData = {
      balance: new BigNumber(usdcToAtomic("50000000")),
      loaded: true,
    }
    const {container} = renderWithdrawalForm(poolData, capitalProvider)

    expect(await screen.findByText("Available to withdraw: $50,072.85")).toBeVisible()
    expect(await screen.findByText("Max")).toBeVisible()
    expect(await screen.findByText("Submit")).toBeVisible()
    expect(await screen.findByText("Cancel")).toBeVisible()
    expect(await screen.findByText("Withdraw")).toBeVisible()

    const formParagraph = await container.getElementsByClassName("paragraph")
    expect(formParagraph[0]?.textContent).toContain(
      "You have 128.89 GFI ($128.89) that is still vesting until Jan 5, 2023. If you withdraw before then, you might forfeit a portion of your unvested GFI"
    )
    expect(formParagraph[1]?.textContent).toContain(
      "Also as a reminder, the protocol will deduct a 0.50% fee from your withdrawal amount for protocol reserves."
    )
  })

  it("fills max amount with transactionLimit when using claimable staking reward", async () => {
    const {user} = await setupClaimableStakingReward(goldfinchProtocol, seniorPool)

    mockCapitalProviderCalls()
    const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)

    const poolData = {
      balance: new BigNumber(usdcToAtomic("50000000")),
      loaded: true,
    }
    renderWithdrawalForm(poolData, capitalProvider)

    fireEvent.click(screen.getByText("Max", {selector: "button"}))

    await waitFor(() => {
      expect(screen.getByPlaceholderText("0")).toHaveProperty("value", "20,000")
      expect(screen.getByText("receive $19,900.00")).toBeVisible()
      expect(screen.getByText("forfeit 51.40 GFI ($51.40)")).toBeVisible()
    })
  })

  it("fills max amount with pool balance when using claimable staking reward", async () => {
    const {user} = await setupClaimableStakingReward(goldfinchProtocol, seniorPool)

    mockCapitalProviderCalls()
    const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)

    const poolData = {
      balance: new BigNumber(usdcToAtomic("10000")),
      loaded: true,
    }
    renderWithdrawalForm(poolData, capitalProvider)

    fireEvent.click(screen.getByText("Max", {selector: "button"}))

    await waitFor(() => {
      expect(screen.getByPlaceholderText("0")).toHaveProperty("value", "10,000")
      expect(screen.getByText("receive $9,950.00")).toBeVisible()
      expect(screen.getByText("forfeit 25.64 GFI ($25.64)")).toBeVisible()
    })
  })

  it("fills max amount with availableAmount when using claimable staking reward", async () => {
    const {user} = await setupClaimableStakingReward(goldfinchProtocol, seniorPool)

    mockCapitalProviderCalls()
    const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)
    capitalProvider.value.availableToWithdrawInDollars = new BigNumber("8000")

    const poolData = {
      balance: new BigNumber(usdcToAtomic("50000000")),
      loaded: true,
    }
    renderWithdrawalForm(poolData, capitalProvider)

    fireEvent.click(screen.getByText("Max", {selector: "button"}))

    await waitFor(() => {
      expect(screen.getByPlaceholderText("0")).toHaveProperty("value", "8,000")
      expect(screen.getByText("receive $7,960.00")).toBeVisible()
      expect(screen.getByText("forfeit 20.48 GFI ($20.48)")).toBeVisible()
    })
  })

  it("show withdrawal form with partially claimed staking reward", async () => {
    const {user} = await setupPartiallyClaimedStakingReward(goldfinchProtocol, seniorPool)

    mockCapitalProviderCalls()
    const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)

    const poolData = {
      balance: new BigNumber(usdcToAtomic("50000000")),
      loaded: true,
    }
    const {container} = renderWithdrawalForm(poolData, capitalProvider)

    expect(await screen.findByText("Available to withdraw: $50,072.85")).toBeVisible()
    expect(await screen.findByText("Max")).toBeVisible()
    expect(await screen.findByText("Submit")).toBeVisible()
    expect(await screen.findByText("Cancel")).toBeVisible()
    expect(await screen.findByText("Withdraw")).toBeVisible()

    const formParagraph = await container.getElementsByClassName("paragraph")
    expect(formParagraph[0]?.textContent).toContain(
      "You have 265.94 GFI ($265.94) that is still vesting until Jan 5, 2023. If you withdraw before then, you might forfeit a portion of your unvested GFI"
    )
    expect(formParagraph[1]?.textContent).toContain(
      "Also as a reminder, the protocol will deduct a 0.50% fee from your withdrawal amount for protocol reserves."
    )
  })

  it("withdrawal calls correct contract methods with all fidu staked", async () => {
    const {user, stakingRewards} = await setupPartiallyClaimedStakingReward(goldfinchProtocol, seniorPool)

    mockCapitalProviderCalls(undefined, "0")
    const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)
    const poolData = {
      balance: new BigNumber(usdcToAtomic("50000000")),
      loaded: true,
    }
    const mockTransaction = mock({
      blockchain,
      transaction: {
        to: DEPLOYMENTS.contracts.StakingRewards.address,
        api: stakingRewardsABI,
        method: "unstakeAndWithdrawInFidu",
        params: {tokenId: "1", fiduAmount: "19990871828478113245933"},
      },
    })
    web3.eth.getGasPrice = () => {
      return Promise.resolve("100000000")
    }
    const networkMonitor = {
      addPendingTX: () => {},
      watch: () => {},
      markTXErrored: () => {},
    }
    const refreshCurrentBlock = jest.fn()
    renderWithdrawalForm(
      poolData,
      capitalProvider,
      stakingRewards,
      seniorPool,
      refreshCurrentBlock,
      networkMonitor,
      user
    )

    fireEvent.click(screen.getByText("Max", {selector: "button"}))
    await waitFor(async () => {
      expect(screen.getByPlaceholderText("0")).toHaveProperty("value", "20,000")
    })

    fireEvent.click(screen.getByText("Submit"))
    await waitFor(async () => {
      expect(await screen.getByText("Submitting...")).toBeInTheDocument()
    })

    expect(mockTransaction).toHaveBeenCalled()
  })

  it("withdrawal calls correct contract methods with all fidu unstaked", async () => {
    const {user, stakingRewards} = await setupPartiallyClaimedStakingReward(goldfinchProtocol, seniorPool)

    mockCapitalProviderCalls(undefined, "500000000000000000000000")
    const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)
    const poolData = {
      balance: new BigNumber(usdcToAtomic("50000000")),
      loaded: true,
    }
    const mockTransaction = mock({
      blockchain,
      transaction: {
        to: DEPLOYMENTS.contracts.SeniorPool.address,
        api: DEPLOYMENTS.contracts.SeniorPool.abi,
        method: "withdrawInFidu",
        params: "19990871828478113245933",
      },
    })
    web3.eth.getGasPrice = () => {
      return Promise.resolve("100000000")
    }
    const networkMonitor = {
      addPendingTX: () => {},
      watch: () => {},
      markTXErrored: () => {},
    }
    const refreshCurrentBlock = jest.fn()
    renderWithdrawalForm(
      poolData,
      capitalProvider,
      stakingRewards,
      seniorPool,
      refreshCurrentBlock,
      networkMonitor,
      user
    )

    fireEvent.click(screen.getByText("Max", {selector: "button"}))
    await waitFor(async () => {
      expect(screen.getByPlaceholderText("0")).toHaveProperty("value", "20,000")
    })

    fireEvent.click(screen.getByText("Submit"))
    await waitFor(async () => {
      expect(await screen.getByText("Submitting...")).toBeInTheDocument()
    })

    expect(mockTransaction).toHaveBeenCalled()
  })

  it("withdrawal calls correct contract methods with fidu unstaked and fidu staked", async () => {
    const {user, stakingRewards} = await setupPartiallyClaimedStakingReward(goldfinchProtocol, seniorPool)

    mockCapitalProviderCalls(undefined, "10000000000000000000000")
    const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)
    const poolData = {
      balance: new BigNumber(usdcToAtomic("50000000")),
      loaded: true,
    }

    const mockSeniorPoolTransaction = mock({
      blockchain,
      transaction: {
        to: DEPLOYMENTS.contracts.SeniorPool.address,
        api: DEPLOYMENTS.contracts.SeniorPool.abi,
        method: "withdrawInFidu",
        params: "10000000000000000000000",
      },
    })
    const mockStakingRewardsTransaction = mock({
      blockchain,
      transaction: {
        to: DEPLOYMENTS.contracts.StakingRewards.address,
        api: stakingRewardsABI,
        method: "unstakeAndWithdrawInFidu",
        params: {tokenId: "1", fiduAmount: "9990871828478113245933"},
      },
    })
    web3.eth.getGasPrice = () => {
      return Promise.resolve("100000000")
    }
    const networkMonitor = {
      addPendingTX: () => {},
      watch: () => {},
      markTXErrored: () => {},
    }
    const refreshCurrentBlock = jest.fn()
    renderWithdrawalForm(
      poolData,
      capitalProvider,
      stakingRewards,
      seniorPool,
      refreshCurrentBlock,
      networkMonitor,
      user
    )

    fireEvent.click(screen.getByText("Max", {selector: "button"}))
    await waitFor(async () => {
      expect(screen.getByPlaceholderText("0")).toHaveProperty("value", "20,000")
    })

    fireEvent.click(screen.getByText("Submit"))
    await waitFor(async () => {
      expect(await screen.getByText("Submitting...")).toBeInTheDocument()
    })

    expect(mockSeniorPoolTransaction).toHaveBeenCalled()
    expect(mockStakingRewardsTransaction).toHaveBeenCalled()
  })
})
