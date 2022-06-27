import "@testing-library/jest-dom"
import {fireEvent, render, screen, waitFor} from "@testing-library/react"
import {BigNumber} from "bignumber.js"
import {mock} from "@depay/web3-mock"
import {BrowserRouter as Router} from "react-router-dom"
import sinon from "sinon"
import {AppContext} from "../../App"
import WithdrawalForm from "../../components/WithdrawalForm"
import {usdcToAtomic} from "../../ethereum/erc20"
import {COINGECKO_API_GFI_PRICE_URL, GFILoaded} from "../../ethereum/gfi"
import {GoldfinchConfigData} from "../../ethereum/goldfinchConfig"
import {GoldfinchProtocol} from "../../ethereum/GoldfinchProtocol"
import {NetworkMonitor} from "../../ethereum/networkMonitor"
import {
  CapitalProvider,
  fetchCapitalProviderData,
  mockGetWeightedAverageSharePrice,
  SeniorPoolData,
  SeniorPool,
  SeniorPoolLoaded,
  StakingRewardsLoaded,
} from "../../ethereum/pool"
import {UserLoaded} from "../../ethereum/user"
import * as utils from "../../ethereum/utils"
import {assertWithLoadedInfo, Loaded} from "../../types/loadable"
import {BlockInfo} from "../../utils"
import getWeb3 from "../../web3"
import {
  blockchain,
  defaultCurrentBlock,
  getDeployments,
  getStakingRewardsAbi,
  network,
} from "../rewards/__utils__/constants"
import {mockCapitalProviderCalls, resetAirdropMocks} from "../rewards/__utils__/mocks"
import {
  prepareBaseDeps,
  prepareUserRelatedDeps,
  setupClaimableStakingReward,
  setupMultiplePartiallyClaimedStakingRewards,
  setupPartiallyClaimedStakingReward,
} from "../rewards/__utils__/scenarios"

mock({
  blockchain: "ethereum",
})

const web3 = getWeb3()
web3.readOnly.setProvider((global.window as any).ethereum)
web3.userWallet.setProvider((global.window as any).ethereum)

function renderWithdrawalForm(
  poolData: Partial<SeniorPoolData>,
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
          poolData={poolData as SeniorPoolData}
          capitalProvider={capitalProvider.value}
          actionComplete={() => {}}
          closeForm={() => {}}
        />
      </Router>
    </AppContext.Provider>
  )
}

describe("withdrawal form", () => {
  let sandbox = sinon.createSandbox()
  const networkMonitor = {
    addPendingTX: () => {},
    watch: () => {},
    markTXErrored: () => {},
  } as unknown as NetworkMonitor
  let seniorPool: SeniorPoolLoaded
  let goldfinchProtocol = new GoldfinchProtocol(network)
  let gfi: GFILoaded, stakingRewards: StakingRewardsLoaded, user: UserLoaded, capitalProvider: Loaded<CapitalProvider>
  const currentBlock = defaultCurrentBlock

  afterEach(() => {
    sandbox.restore()
  })

  beforeEach(async () => {
    jest.spyOn(utils, "getDeployments").mockImplementation(() => {
      return getDeployments()
    })

    jest.spyOn(global, "fetch").mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString()
      if (url === COINGECKO_API_GFI_PRICE_URL) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              goldfinch: {
                usd: 2,
              },
            }),
        } as Response)
      } else {
        throw new Error(`Unexpected fetch url: ${url}`)
      }
    })

    resetAirdropMocks(goldfinchProtocol)

    await goldfinchProtocol.initialize()
    const _seniorPoolLoaded = new SeniorPool(goldfinchProtocol)
    _seniorPoolLoaded.info = {
      loaded: true,
      value: {
        currentBlock,
        poolData: {} as SeniorPoolData,
        isPaused: false,
      },
    }
    assertWithLoadedInfo(_seniorPoolLoaded)
    seniorPool = _seniorPoolLoaded
  })
  beforeEach(async () => {
    const baseDeps = await prepareBaseDeps(goldfinchProtocol, currentBlock)
    gfi = baseDeps.gfi
    stakingRewards = baseDeps.stakingRewards
    const userRelatedDeps = await prepareUserRelatedDeps({goldfinchProtocol, seniorPool, ...baseDeps}, {currentBlock})
    user = userRelatedDeps.user

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

  describe("when the senior pool does have liquidity", () => {
    const poolBalanceInAtoms = new BigNumber(1e6)
    const withdrawalAmountInAtoms = poolBalanceInAtoms
    const withdrawAmountInUsdc = withdrawalAmountInAtoms.dividedBy(1e6).toFixed(6)
    const poolData = {
      balance: poolBalanceInAtoms,
    }
    beforeEach(async () => {
      await waitFor(async () => {
        expect(withdrawalAmountInAtoms.toNumber()).toBeLessThanOrEqual(poolBalanceInAtoms.toNumber())
        renderWithdrawalForm(poolData, capitalProvider, undefined, undefined, currentBlock)
        fireEvent.change(screen.getByPlaceholderText("0"), {target: {value: withdrawAmountInUsdc}})
      })
    })

    it("should enable the 'submit' button", async () => {
      await waitFor(async () => {
        const submitButton = await screen.findByText("Submit")
        expect(submitButton).toBeVisible()
        expect(submitButton).not.toHaveClass("disabled")
      })
    })

    it("should not display a warning", async () => {
      await waitFor(async () => {
        try {
          await screen.getByTestId("liquidity-advisory")
        } catch (e) {
          // we expect the above line to throw an exception because the
          // liquidity advisory should not be able to found
        }
      })
    })
  })

  describe("when the senior pool doesn't have liquidity", () => {
    const poolBalanceInAtoms = new BigNumber(1e6)
    const withdrawalAmountInAtoms = poolBalanceInAtoms.plus(1)
    const withdrawAmountInUsdc = withdrawalAmountInAtoms.dividedBy(1e6).toFixed(6)
    const poolData = {
      balance: poolBalanceInAtoms,
    }
    beforeEach(async () => {
      await waitFor(async () => {
        expect(withdrawalAmountInAtoms.toNumber()).toBeGreaterThan(poolBalanceInAtoms.toNumber())
        renderWithdrawalForm(poolData, capitalProvider, undefined, undefined, currentBlock)
        fireEvent.change(screen.getByPlaceholderText("0"), {target: {value: withdrawAmountInUsdc}})
      })
    })

    it("should disable the 'submit' button", async () => {
      await waitFor(async () => {
        const submitButton = await screen.findByText("Submit")
        expect(submitButton).toBeVisible()
        expect(submitButton).toHaveClass("disabled")
      })
    })

    it("should display a warning", async () => {
      await waitFor(async () => {
        const liquidityAdvisory = await screen.getByTestId("liquidity-advisory")
        expect(liquidityAdvisory).not.toEqual(null)
        expect(liquidityAdvisory).toBeVisible()
      })
    })
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
      "You have 128.89 GFI ($257.78) that is still locked until Dec 29, 2022. If you withdraw before then, you might forfeit a portion of your locked GFI."
    )
    expect(formParagraph[1]?.textContent).toContain(
      "Also as a reminder, the protocol will deduct a 0.50% fee from your withdrawal amount for protocol reserves."
    )
  })

  describe("Max button", () => {
    it("uses `transactionLimit` for withdrawal amount when applicable", async () => {
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
        expect(screen.getByText("forfeit 51.40 GFI ($102.81)")).toBeVisible()
      })
    })

    it("uses pool balance for withdrawal amount when applicable", async () => {
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
        expect(screen.getByText("forfeit 25.64 GFI ($51.27)")).toBeVisible()
      })
    })

    it("uses the user's number of withdrawable FIDU for the withdrawal amount, when the user's `availableToWithdrawInDollars` is the applicable limit on the withdrawal", async () => {
      // The purpose of this test is to establish that when the user's `availableToWithdrawInDollars` amount is the applicable limit
      // on how much they can withdraw, we actually use their number of withdrawable FIDU directly as the amount we
      // want to withdraw in FIDU -- rather than converting `availableToWithdrawInDollars` into FIDU, which would be
      // liable to leave dust due to imprecision in the conversion.

      const {user} = await setupClaimableStakingReward(goldfinchProtocol, seniorPool, currentBlock)

      await mockCapitalProviderCalls()
      const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)
      expect(capitalProvider.value.availableToWithdrawInDollars.toString(10)).toEqual("50072.853679849")
      capitalProvider.value.availableToWithdrawInDollars = new BigNumber("8000")

      const poolData = {
        balance: new BigNumber(usdcToAtomic("50000000")),
      }
      renderWithdrawalForm(poolData, capitalProvider, undefined, undefined, currentBlock)

      fireEvent.click(screen.getByText("Max", {selector: "button"}))

      await waitFor(() => {
        expect(screen.getByPlaceholderText("0")).toHaveProperty("value", "8,000")
        expect(screen.getByText("receive $7,960.00")).toBeVisible()
        // HACK: We expect unvested GFI to be forfeited in the same proportion as the user's FIDU that
        // is being unstaked-and-withdrawn. So we infer here, from the fact that all of the user's unvested
        // GFI would be forfeited, that the withdrawal is configured to unstake-and-withdraw all of the
        // user's FIDU -- which is the Max button behavior this test aims to establish.
        expect(capitalProvider.value.rewardsInfo.unvested?.toString(10)).toEqual("128889863013698630137")
        expect(screen.getByText("forfeit 128.89 GFI ($257.78)")).toBeVisible()
      })
    })
  })

  it("fills max amount and is not limited by the user balance", async () => {
    const {user} = await setupClaimableStakingReward(goldfinchProtocol, seniorPool, currentBlock)
    user.info.value.usdcBalanceInDollars = new BigNumber(0)

    await mockCapitalProviderCalls()
    const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)
    capitalProvider.value.availableToWithdrawInDollars = new BigNumber("10000")

    const poolData = {
      balance: new BigNumber(usdcToAtomic("50000000")),
    }
    renderWithdrawalForm(poolData, capitalProvider, undefined, undefined, currentBlock, undefined, undefined, user)

    fireEvent.click(screen.getByText("Max", {selector: "button"}))

    await waitFor(() => {
      expect(screen.getByPlaceholderText("0")).toHaveProperty("value", "10,000")
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
      "You have 265.94 GFI ($531.89) that is still locked until Dec 29, 2022. If you withdraw before then, you might forfeit a portion of your locked GFI"
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
      web3.userWallet.eth.getGasPrice = () => {
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
      web3.userWallet.eth.getGasPrice = () => {
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
      web3.userWallet.eth.getGasPrice = () => {
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
      web3.userWallet.eth.getGasPrice = () => {
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
