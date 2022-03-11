import "@testing-library/jest-dom"
import _ from "lodash"
import BigNumber from "bignumber.js"
import {AppContext} from "../App"
import DepositForm from "./depositForm"
import {render, screen, fireEvent, waitFor} from "@testing-library/react"
import {usdcToAtomic} from "../ethereum/erc20"
import {mock} from "depay-web3-mock"
import {
  blockchain,
  defaultCurrentBlock,
  getDeployments,
  getSeniorPoolAbi,
  getStakingRewardsAbi,
  network,
} from "../__tests__/rewards/__utils__/constants"
import getWeb3 from "../web3"
import {setupPartiallyClaimedStakingReward} from "../__tests__/rewards/__utils__/scenarios"
import {resetAirdropMocks} from "../__tests__/rewards/__utils__/mocks"
import {
  mockGetWeightedAverageSharePrice,
  SeniorPoolData,
  SeniorPool,
  SeniorPoolLoaded,
  StakingRewardsLoaded,
} from "../ethereum/pool"
import {NetworkMonitor} from "../ethereum/networkMonitor"
import {GoldfinchProtocol} from "../ethereum/GoldfinchProtocol"
import {UserLoaded} from "../ethereum/user"
import {assertWithLoadedInfo} from "../types/loadable"
import {BlockInfo} from "../utils"
import * as utils from "../ethereum/utils"

mock({
  blockchain: "ethereum",
})

const web3 = getWeb3()
web3.readOnly.setProvider((global.window as any).ethereum)
web3.userWallet.setProvider((global.window as any).ethereum)

const mockGatherPermitSignature = () => ({
  v: 100,
  r: "0x0000000000000000000000000000000000000000000000000000000000000043",
  s: "0x0000000000000000000000000000000000000000000000000000000000000034",
  deadline: new BigNumber(100),
  nonce: "",
  owner: "",
  spender: "",
  chainId: "",
  tokenAddress: "",
  value: new BigNumber(50000),
})

jest.mock("../hooks/useERC20Permit", () => ({
  __esModule: true,
  default: () => ({
    gatherPermitSignature: mockGatherPermitSignature,
  }),
}))

function renderDepositForm(
  transactionLimit: string,
  userBalance: string,
  remainingCapacity: string,
  estimatedApyFromGfi: string,
  stakingRewards?: StakingRewardsLoaded | undefined,
  currentBlock?: BlockInfo,
  refreshCurrentBlock?: () => Promise<void>,
  networkMonitor?: NetworkMonitor,
  user?: UserLoaded
) {
  let store = {
    goldfinchConfig: {
      transactionLimit: new BigNumber(usdcToAtomic(transactionLimit)),
    },
    user: {
      ...user,
      info: {
        loaded: true,
        value: {
          usdcBalanceInDollars: new BigNumber(userBalance),
          usdcBalance: new BigNumber(usdcToAtomic(userBalance)),
        },
      },
    },
    pool: {
      info: {
        loaded: true,
        value: {
          poolData: {
            remainingCapacity: () => new BigNumber(usdcToAtomic(remainingCapacity)),
            totalPoolAssets: new BigNumber(0),
            estimatedApyFromGfi: new BigNumber(estimatedApyFromGfi),
          },
        },
      },
    },
    usdc: {
      name: "USD Coin",
      contract: {},
    },
    currentBlock,
    stakingRewards,
    refreshCurrentBlock,
    networkMonitor,
  }
  return render(
    // @ts-expect-error ts-migrate(2322) FIXME: Type '{ goldfinchConfig: { transactionLimit: BigNu... Remove this comment to see the full error message
    <AppContext.Provider value={store}>
      <DepositForm actionComplete={_.noop} closeForm={_.noop} />
    </AppContext.Provider>
  )
}

describe("max transaction amount for depositForm", () => {
  it("fills the transaction amount with the user balance", async () => {
    let remainingCapacity = "300",
      transactionLimit = "200",
      userBalance = "100",
      estimatedApyFromGfi = "0.125"
    renderDepositForm(transactionLimit, userBalance, remainingCapacity, estimatedApyFromGfi)
    fireEvent.click(screen.getByText("Supply"))
    fireEvent.click(screen.getByText("Max", {selector: "button"}))

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toHaveProperty("value", userBalance.toString())
    })
  })

  it("fills the transaction amount with the transaction limit", async () => {
    let remainingCapacity = "300",
      transactionLimit = "200",
      userBalance = "500",
      estimatedApyFromGfi = "0.125"
    renderDepositForm(transactionLimit, userBalance, remainingCapacity, estimatedApyFromGfi)
    fireEvent.click(screen.getByText("Supply"))
    fireEvent.click(screen.getByText("Max", {selector: "button"}))

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toHaveProperty("value", transactionLimit.toString())
    })
  })

  it("fills the transaction amount with the remaining limit", async () => {
    let remainingCapacity = "300",
      transactionLimit = "400",
      userBalance = "500",
      estimatedApyFromGfi = "0.125"
    renderDepositForm(transactionLimit, userBalance, remainingCapacity, estimatedApyFromGfi)
    fireEvent.click(screen.getByText("Supply"))
    fireEvent.click(screen.getByText("Max", {selector: "button"}))

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toHaveProperty("value", remainingCapacity.toString())
    })
  })

  it("has no more than 6 digital places", async () => {
    let remainingCapacity = "300",
      transactionLimit = "200",
      userBalance = "100.98098978",
      estimatedApyFromGfi = "0.125"
    renderDepositForm(transactionLimit, userBalance, remainingCapacity, estimatedApyFromGfi)
    fireEvent.click(screen.getByText("Supply"))
    fireEvent.click(screen.getByText("Max", {selector: "button"}))

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toHaveProperty("value", "100.980989")
    })
  })
})

describe("deposit form", () => {
  it("submits the deposit form successfully", async () => {
    const remainingCapacity = "300"
    const transactionLimit = "200"
    const userBalance = "1000"
    const estimatedApyFromGfi = "0.125"
    renderDepositForm(transactionLimit, userBalance, remainingCapacity, estimatedApyFromGfi)
    fireEvent.click(screen.getByText("Supply"))

    const seniorPoolAgreementCheckbox = screen.getByTestId("agreement")
    fireEvent.click(seniorPoolAgreementCheckbox)

    const amountInput = screen.getByPlaceholderText("0")
    fireEvent.change(amountInput, {target: {value: "100"}})

    await waitFor(async () => {
      expect(screen.getByText("Submit")).not.toBeDisabled()
    })
    fireEvent.click(screen.getByText("Submit"))
    await waitFor(async () => {
      expect(await screen.getByText("Submitting...")).toBeInTheDocument()
    })
  })
})

describe("deposit transactions", () => {
  const networkMonitor = {
    addPendingTX: () => {},
    watch: () => {},
    markTXErrored: () => {},
  } as unknown as NetworkMonitor
  let seniorPool: SeniorPoolLoaded
  let goldfinchProtocol = new GoldfinchProtocol(network)
  const currentBlock = defaultCurrentBlock

  beforeEach(async () => {
    jest.spyOn(utils, "getDeployments").mockImplementation(() => {
      return getDeployments()
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

  afterEach(() => {
    mockGetWeightedAverageSharePrice(undefined)
    jest.clearAllMocks()
  })

  it("clicking to submit the form when staking triggers depositWithPermitAndStake()", async () => {
    const {user, stakingRewards} = await setupPartiallyClaimedStakingReward(
      goldfinchProtocol,
      seniorPool,
      undefined,
      currentBlock
    )

    const DEPLOYMENTS = await getDeployments()
    const mockTransaction = mock({
      blockchain,
      transaction: {
        to: DEPLOYMENTS.contracts.StakingRewards.address,
        api: await getStakingRewardsAbi(),
        method: "depositWithPermitAndStake",
        params: {
          usdcAmount: new BigNumber(50000),
          deadline: new BigNumber(100),
          v: 100,
          r: "0x0000000000000000000000000000000000000000000000000000000000000043",
          s: "0x0000000000000000000000000000000000000000000000000000000000000034",
        },
      },
    })
    web3.userWallet.eth.getGasPrice = () => {
      return Promise.resolve("100000000")
    }
    const refreshCurrentBlock = jest.fn()

    const remainingCapacity = "300"
    const transactionLimit = "200"
    const userBalance = "1000"
    const estimatedApyFromGfi = "0.125"
    renderDepositForm(
      transactionLimit,
      userBalance,
      remainingCapacity,
      estimatedApyFromGfi,
      stakingRewards,
      currentBlock,
      refreshCurrentBlock,
      networkMonitor,
      user
    )
    fireEvent.click(screen.getByText("Supply"))

    const seniorPoolAgreementCheckbox = screen.getByTestId("agreement")
    fireEvent.click(seniorPoolAgreementCheckbox)

    const amountInput = screen.getByPlaceholderText("0")
    fireEvent.change(amountInput, {target: {value: "100"}})

    await waitFor(async () => {
      expect(screen.getByText("Submit")).not.toBeDisabled()
    })
    await fireEvent.click(screen.getByText("Submit"))
    await waitFor(async () => {
      expect(await screen.getByText("Submitting...")).toBeInTheDocument()
    })

    expect(mockTransaction).toHaveBeenCalled()
  })

  it("clicking to submit the form when not staking does not trigger depositWithPermitAndStake()", async () => {
    const {user, stakingRewards} = await setupPartiallyClaimedStakingReward(
      goldfinchProtocol,
      seniorPool,
      undefined,
      currentBlock
    )

    const DEPLOYMENTS = await getDeployments()
    const mockTransaction = mock({
      blockchain,
      transaction: {
        to: DEPLOYMENTS.contracts.SeniorPool.address,
        api: await getSeniorPoolAbi(),
        method: "deposit",
        params: {},
      },
    })
    web3.userWallet.eth.getGasPrice = () => {
      return Promise.resolve("100000000")
    }
    const refreshCurrentBlock = jest.fn()

    const remainingCapacity = "300"
    const transactionLimit = "200"
    const userBalance = "1000"
    const estimatedApyFromGfi = "0.125"
    renderDepositForm(
      transactionLimit,
      userBalance,
      remainingCapacity,
      estimatedApyFromGfi,
      stakingRewards,
      currentBlock,
      refreshCurrentBlock,
      networkMonitor,
      user
    )
    fireEvent.click(screen.getByText("Supply"))

    // It unchecks the staking checkbox
    const stakingCheckbox = screen.getByTestId("staking")
    fireEvent.click(stakingCheckbox)

    const seniorPoolAgreementCheckbox = screen.getByTestId("agreement")
    fireEvent.click(seniorPoolAgreementCheckbox)

    const amountInput = screen.getByPlaceholderText("0")
    fireEvent.change(amountInput, {target: {value: "100"}})

    await waitFor(async () => {
      expect(screen.getByText("Submit")).not.toBeDisabled()
    })
    await fireEvent.click(screen.getByText("Submit"))
    await waitFor(async () => {
      expect(await screen.getByText("Submitting...")).toBeInTheDocument()
    })

    expect(mockTransaction).not.toHaveBeenCalled()
  })
})
