import {CreditDesk} from "@goldfinch-eng/protocol/typechain/web3/CreditDesk"
import "@testing-library/jest-dom"
import {fireEvent, render, screen, waitFor} from "@testing-library/react"
import {BigNumber} from "bignumber.js"
import {mock} from "depay-web3-mock"
import {BrowserRouter as Router} from "react-router-dom"
import {AppContext} from "../../App"
import WithdrawalForm from "../../components/withdrawalForm"
import {CommunityRewardsLoaded} from "../../ethereum/communityRewards"
import {usdcToAtomic} from "../../ethereum/erc20"
import {GFILoaded} from "../../ethereum/gfi"
import {GoldfinchConfigData} from "../../ethereum/goldfinchConfig"
import {GoldfinchProtocol} from "../../ethereum/GoldfinchProtocol"
import {MerkleDirectDistributorLoaded} from "../../ethereum/merkleDirectDistributor"
import {MerkleDistributorLoaded} from "../../ethereum/merkleDistributor"
import {NetworkMonitor} from "../../ethereum/networkMonitor"
import {
  CapitalProvider,
  fetchCapitalProviderData,
  mockGetWeightedAverageSharePrice,
  PoolData,
  SeniorPool,
  SeniorPoolLoaded,
  StakingRewardsLoaded,
} from "../../ethereum/pool"
import {User, UserLoaded} from "../../ethereum/user"
import * as utils from "../../ethereum/utils"
import {assertWithLoadedInfo, Loaded} from "../../types/loadable"
import {BlockInfo} from "../../utils"
import web3 from "../../web3"
import {
  blockchain,
  defaultCurrentBlock,
  getDeployments,
  getStakingRewardsAbi,
  network,
  recipient,
} from "../rewards/__utils__/constants"
import {
  mockCapitalProviderCalls,
  mockUserInitializationContractCalls,
  resetAirdropMocks,
} from "../rewards/__utils__/mocks"
import {
  getDefaultClasses,
  setupClaimableStakingReward,
  setupMultiplePartiallyClaimedStakingRewards,
  setupPartiallyClaimedStakingReward,
} from "../rewards/__utils__/scenarios"

mock({
  blockchain: "ethereum",
})

web3.setProvider((global.window as any).ethereum)

function renderWithdrawalForm(
  poolData: Partial<PoolData>,
  capitalProvider: Loaded<CapitalProvider>,
  stakingRewards: StakingRewardsLoaded | undefined,
  pool: SeniorPoolLoaded | undefined,
  currentBlock: BlockInfo,
  refreshCurrentBlock?: () => Promise<void>,
  networkMonitor?: NetworkMonitor,
  user?: UserLoaded
) {
  const store = {
    currentBlock,
    goldfinchConfig: {
      transactionLimit: new BigNumber(usdcToAtomic("20000")),
    } as GoldfinchConfigData,
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
          poolData={poolData as PoolData}
          capitalProvider={capitalProvider.value}
          actionComplete={() => {}}
          closeForm={() => {}}
        />
      </Router>
    </AppContext.Provider>
  )
}

describe("withdrawal form", () => {
  const networkMonitor = {
    addPendingTX: () => {},
    watch: () => {},
    markTXErrored: () => {},
  } as unknown as NetworkMonitor
  let seniorPool: SeniorPoolLoaded
  let goldfinchProtocol = new GoldfinchProtocol(network)
  let gfi: GFILoaded,
    stakingRewards: StakingRewardsLoaded,
    communityRewards: CommunityRewardsLoaded,
    merkleDistributor: MerkleDistributorLoaded,
    merkleDirectDistributor: MerkleDirectDistributorLoaded,
    user: UserLoaded,
    capitalProvider: Loaded<CapitalProvider>
  const currentBlock = defaultCurrentBlock

  beforeEach(async () => {
    jest.spyOn(utils, "getDeployments").mockImplementation(() => {
      return getDeployments()
    })
    resetAirdropMocks()

    await goldfinchProtocol.initialize()
    const _seniorPoolLoaded = new SeniorPool(goldfinchProtocol)
    _seniorPoolLoaded.info = {
      loaded: true,
      value: {
        currentBlock,
        poolData: {} as PoolData,
        isPaused: false,
      },
    }
    assertWithLoadedInfo(_seniorPoolLoaded)
    seniorPool = _seniorPoolLoaded
  })
  beforeEach(async () => {
    const result = await getDefaultClasses(goldfinchProtocol, currentBlock)
    gfi = result.gfi
    stakingRewards = result.stakingRewards
    communityRewards = result.communityRewards
    merkleDistributor = result.merkleDistributor
    merkleDirectDistributor = result.merkleDirectDistributor

    const _user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
    await mockUserInitializationContractCalls(_user, stakingRewards, gfi, communityRewards, merkleDistributor, {
      currentBlock,
    })
    await _user.initialize(
      seniorPool,
      stakingRewards,
      gfi,
      communityRewards,
      merkleDistributor,
      merkleDirectDistributor,
      currentBlock
    )

    assertWithLoadedInfo(_user)
    user = _user

    await mockCapitalProviderCalls()
    capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)
  })

  afterEach(() => {
    mockGetWeightedAverageSharePrice(undefined)
    jest.clearAllMocks()
  })

  it("shows withdrawal form", async () => {
    const poolData = {
      balance: new BigNumber(usdcToAtomic("50000000")),
    }
    renderWithdrawalForm(poolData, capitalProvider, undefined, undefined, currentBlock)

    expect(await screen.findByText("Available to withdraw: $50.02")).toBeVisible()
    expect(await screen.findByText("Max")).toBeVisible()
    expect(await screen.findByText("Submit")).toBeVisible()
    expect(await screen.findByText("Cancel")).toBeVisible()
    expect(await screen.findByText("Withdraw")).toBeVisible()
  })

  it("shows withdrawal form, to user with claimable staking reward", async () => {
    const {user} = await setupClaimableStakingReward(goldfinchProtocol, seniorPool, currentBlock)

    await mockCapitalProviderCalls()
    const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)

    const poolData = {
      balance: new BigNumber(usdcToAtomic("50000000")),
    }
    const {container} = renderWithdrawalForm(poolData, capitalProvider, undefined, undefined, currentBlock)

    expect(await screen.findByText("Available to withdraw: $50,072.85")).toBeVisible()
    expect(await screen.findByText("Max")).toBeVisible()
    expect(await screen.findByText("Submit")).toBeVisible()
    expect(await screen.findByText("Cancel")).toBeVisible()
    expect(await screen.findByText("Withdraw")).toBeVisible()

    const formParagraph = await container.getElementsByClassName("paragraph")
    expect(formParagraph[0]?.textContent).toContain(
      "You have 128.89 GFI ($128.89) that is still vesting until Dec 29, 2022. If you withdraw before then, you might forfeit a portion of your unvested GFI."
    )
    expect(formParagraph[1]?.textContent).toContain(
      "Also as a reminder, the protocol will deduct a 0.50% fee from your withdrawal amount for protocol reserves."
    )
  })

  it("fills max amount with `transactionLimit` when appropriate", async () => {
    const {user} = await setupClaimableStakingReward(goldfinchProtocol, seniorPool, currentBlock)

    await mockCapitalProviderCalls()
    const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)

    const poolData = {
      balance: new BigNumber(usdcToAtomic("50000000")),
    }
    renderWithdrawalForm(poolData, capitalProvider, undefined, undefined, currentBlock)

    fireEvent.click(screen.getByText("Max", {selector: "button"}))

    await waitFor(() => {
      expect(screen.getByPlaceholderText("0")).toHaveProperty("value", "20,000")
      expect(screen.getByText("receive $19,900.00")).toBeVisible()
      expect(screen.getByText("forfeit 51.40 GFI ($51.40)")).toBeVisible()
    })
  })

  it("fills max amount with pool balance when appropriate", async () => {
    const {user} = await setupClaimableStakingReward(goldfinchProtocol, seniorPool, currentBlock)

    await mockCapitalProviderCalls()
    const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)

    const poolData = {
      balance: new BigNumber(usdcToAtomic("10000")),
    }
    renderWithdrawalForm(poolData, capitalProvider, undefined, undefined, currentBlock)

    fireEvent.click(screen.getByText("Max", {selector: "button"}))

    await waitFor(() => {
      expect(screen.getByPlaceholderText("0")).toHaveProperty("value", "10,000")
      expect(screen.getByText("receive $9,950.00")).toBeVisible()
      expect(screen.getByText("forfeit 25.64 GFI ($25.64)")).toBeVisible()
    })
  })

  it("fills max amount with `availableToWithdrawInDollars` when appropriate", async () => {
    const {user} = await setupClaimableStakingReward(goldfinchProtocol, seniorPool, currentBlock)

    await mockCapitalProviderCalls()
    const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)
    capitalProvider.value.availableToWithdrawInDollars = new BigNumber("8000")

    const poolData = {
      balance: new BigNumber(usdcToAtomic("50000000")),
    }
    renderWithdrawalForm(poolData, capitalProvider, undefined, undefined, currentBlock)

    fireEvent.click(screen.getByText("Max", {selector: "button"}))

    await waitFor(() => {
      expect(screen.getByPlaceholderText("0")).toHaveProperty("value", "8,000")
      expect(screen.getByText("receive $7,960.00")).toBeVisible()
      expect(screen.getByText("forfeit 20.48 GFI ($20.48)")).toBeVisible()
    })
  })

  it("shows withdrawal form, to user with partially claimed staking reward", async () => {
    const {user} = await setupPartiallyClaimedStakingReward(goldfinchProtocol, seniorPool, undefined, currentBlock)

    await mockCapitalProviderCalls()
    const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)

    const poolData = {
      balance: new BigNumber(usdcToAtomic("50000000")),
    }
    const {container} = renderWithdrawalForm(poolData, capitalProvider, undefined, undefined, currentBlock)

    expect(await screen.findByText("Available to withdraw: $50,072.85")).toBeVisible()
    expect(await screen.findByText("Max")).toBeVisible()
    expect(await screen.findByText("Submit")).toBeVisible()
    expect(await screen.findByText("Cancel")).toBeVisible()
    expect(await screen.findByText("Withdraw")).toBeVisible()

    const formParagraph = await container.getElementsByClassName("paragraph")
    expect(formParagraph[0]?.textContent).toContain(
      "You have 265.94 GFI ($265.94) that is still vesting until Dec 29, 2022. If you withdraw before then, you might forfeit a portion of your unvested GFI"
    )
    expect(formParagraph[1]?.textContent).toContain(
      "Also as a reminder, the protocol will deduct a 0.50% fee from your withdrawal amount for protocol reserves."
    )
  })

  describe("withdrawal transaction(s)", () => {
    it("clicking button with all FIDU staked in one position triggers `unstakeAndWithdrawInFidu()`", async () => {
      const {user, stakingRewards} = await setupPartiallyClaimedStakingReward(
        goldfinchProtocol,
        seniorPool,
        undefined,
        currentBlock
      )

      await mockCapitalProviderCalls(undefined, "0")
      const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)
      const poolData = {
        balance: new BigNumber(usdcToAtomic("50000000")),
      }
      const DEPLOYMENTS = await getDeployments()
      const mockTransaction = mock({
        blockchain,
        transaction: {
          to: DEPLOYMENTS.contracts.StakingRewards.address,
          api: await getStakingRewardsAbi(),
          method: "unstakeAndWithdrawInFidu",
          params: {tokenId: "1", fiduAmount: "19990871828478113245933"},
        },
      })
      web3.eth.getGasPrice = () => {
        return Promise.resolve("100000000")
      }
      const refreshCurrentBlock = jest.fn()
      renderWithdrawalForm(
        poolData,
        capitalProvider,
        stakingRewards,
        seniorPool,
        currentBlock,
        refreshCurrentBlock,
        networkMonitor,
        user
      )

      fireEvent.change(screen.getByPlaceholderText("0"), {target: {value: "20,000"}})
      fireEvent.click(screen.getByText("Submit"))
      await waitFor(async () => {
        expect(screen.getByPlaceholderText("0")).toHaveProperty("value", "20,000")
        expect(screen.getByText("Submit")).not.toBeDisabled()
        fireEvent.click(screen.getByText("Submit"))
      })

      expect(mockTransaction).toHaveBeenCalled()
    })

    it("clicking button with all FIDU unstaked triggers `withdrawInFidu()` ", async () => {
      const {user, stakingRewards} = await setupPartiallyClaimedStakingReward(
        goldfinchProtocol,
        seniorPool,
        undefined,
        currentBlock
      )

      await mockCapitalProviderCalls(undefined, "500000000000000000000000")
      const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)
      const poolData = {
        balance: new BigNumber(usdcToAtomic("50000000")),
      }
      const DEPLOYMENTS = await getDeployments()
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
      const refreshCurrentBlock = jest.fn()
      renderWithdrawalForm(
        poolData,
        capitalProvider,
        stakingRewards,
        seniorPool,
        currentBlock,
        refreshCurrentBlock,
        networkMonitor,
        user
      )

      fireEvent.change(screen.getByPlaceholderText("0"), {target: {value: "20,000"}})
      fireEvent.click(screen.getByText("Submit"))
      await waitFor(async () => {
        expect(screen.getByPlaceholderText("0")).toHaveProperty("value", "20,000")
        expect(screen.getByText("Submit")).not.toBeDisabled()
        fireEvent.click(screen.getByText("Submit"))
      })

      expect(mockTransaction).toHaveBeenCalled()
    })

    it("clicking button with some FIDU unstaked and some FIDU staked triggers `withdrawInFidu()` and then `unstakeAndWithdrawInFidu()`, when staked amount in one position suffices for withdrawal amount", async () => {
      const {user, stakingRewards} = await setupPartiallyClaimedStakingReward(
        goldfinchProtocol,
        seniorPool,
        undefined,
        currentBlock
      )

      await mockCapitalProviderCalls(undefined, "10000000000000000000000")
      const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)
      const poolData = {
        balance: new BigNumber(usdcToAtomic("50000000")),
      }

      const DEPLOYMENTS = await getDeployments()
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
          api: await getStakingRewardsAbi(),
          method: "unstakeAndWithdrawInFidu",
          params: {tokenId: "1", fiduAmount: "9990871828478113245933"},
        },
      })
      web3.eth.getGasPrice = () => {
        return Promise.resolve("100000000")
      }
      const refreshCurrentBlock = jest.fn()
      renderWithdrawalForm(
        poolData,
        capitalProvider,
        stakingRewards,
        seniorPool,
        currentBlock,
        refreshCurrentBlock,
        networkMonitor,
        user
      )

      fireEvent.change(screen.getByPlaceholderText("0"), {target: {value: "20,000"}})
      await waitFor(() => {
        expect(screen.getByPlaceholderText("0")).toHaveProperty("value", "20,000")
        expect(screen.getByText("Submit")).not.toBeDisabled()
        fireEvent.click(screen.getByText("Submit"))
      })

      // TODO How to establish that this was called first?
      expect(mockSeniorPoolTransaction).toHaveBeenCalled()
      expect(mockStakingRewardsTransaction).toHaveBeenCalled()
    })

    it("clicking button with some FIDU unstaked and some FIDU staked triggers `withdrawInFidu()` and then `unstakeAndWithdrawMultipleInFidu()`, when staked amount across multiple positions is necessary to cover withdrawal amount", async () => {
      const {user, stakingRewards} = await setupMultiplePartiallyClaimedStakingRewards(
        goldfinchProtocol,
        seniorPool,
        undefined,
        currentBlock
      )

      const numSharesNotStaked = "100000000000000000000"
      await mockCapitalProviderCalls(undefined, numSharesNotStaked)
      const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)
      const poolData = {
        balance: new BigNumber(usdcToAtomic("50000000")),
      }

      const DEPLOYMENTS = await getDeployments()
      const mockSeniorPoolTransaction = mock({
        blockchain,
        transaction: {
          to: DEPLOYMENTS.contracts.SeniorPool.address,
          api: DEPLOYMENTS.contracts.SeniorPool.abi,
          method: "withdrawInFidu",
          params: numSharesNotStaked,
        },
      })
      const mockStakingRewardsTransaction = mock({
        blockchain,
        transaction: {
          to: DEPLOYMENTS.contracts.StakingRewards.address,
          api: await getStakingRewardsAbi(),
          method: "unstakeAndWithdrawMultipleInFidu",
          params: {tokenIds: ["2", "1"], fiduAmounts: ["5000000000000000000000", "4999998169337911394299"]},
        },
      })
      web3.eth.getGasPrice = () => {
        return Promise.resolve("100000000")
      }
      const refreshCurrentBlock = jest.fn()
      renderWithdrawalForm(
        poolData,
        capitalProvider,
        stakingRewards,
        seniorPool,
        currentBlock,
        refreshCurrentBlock,
        networkMonitor,
        user
      )

      fireEvent.change(screen.getByPlaceholderText("0"), {target: {value: "10,104.61"}})
      await waitFor(() => {
        expect(screen.getByPlaceholderText("0")).toHaveProperty("value", "10,104.61")
        expect(screen.getByText("Submit")).not.toBeDisabled()
        fireEvent.click(screen.getByText("Submit"))
      })

      // TODO How to establish that this was called first?
      expect(mockSeniorPoolTransaction).toHaveBeenCalled()
      expect(mockStakingRewardsTransaction).toHaveBeenCalled()
    })
  })
})
