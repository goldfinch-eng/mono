import _ from "lodash"
import BigNumber from "bignumber.js"
import {AppContext} from "../../App"
import {render, screen, fireEvent, waitFor} from "@testing-library/react"
import {usdcToAtomic} from "../../ethereum/erc20"
import {TranchedPoolDepositForm} from "./tranchedPoolView"

function renderDepositForm(backerLimit, transactionLimit, userBalance, remainingCapacity) {
  let store = {
    goldfinchConfig: {
      transactionLimit: new BigNumber(usdcToAtomic(transactionLimit)),
    },
    user: {
      usdcBalanceInDollars: new BigNumber(userBalance),
      usdcBalance: new BigNumber(usdcToAtomic(userBalance)),
    },
    usdc: {},
    network: {},
    networkMonitor: {},
    setSessionData: {},
  }
  let tranchedPool = {
    metadata: {},
    creditLine: {
      limit: new BigNumber(usdcToAtomic(backerLimit)),
    },
    remainingJuniorCapacity: () => new BigNumber(usdcToAtomic(remainingCapacity)),
  }
  let backer = {
    principalAmount: new BigNumber(0),
  }
  return render(
    <AppContext.Provider value={store}>
      <TranchedPoolDepositForm tranchedPool={tranchedPool} backer={backer} actionComplete={_.noop} closeForm={_.noop} />
    </AppContext.Provider>,
  )
}

describe("max transaction amount for depositForm", () => {
  it("fills the transaction amount with the backer limit", async () => {
    let backerLimit = 100,
      remainingCapacity = 200,
      transactionLimit = 300,
      userBalance = 400
    renderDepositForm(backerLimit, transactionLimit, userBalance, remainingCapacity)
    fireEvent.click(screen.getByText("Supply"))
    fireEvent.click(screen.getByText("Max", {selector: "button"}))

    await waitFor(() => {
      expect(screen.getByPlaceholderText("0")).toHaveProperty("value", backerLimit.toString())
    })
  })

  it("fills the transaction amount with the user balance", async () => {
    let backerLimit = 400,
      remainingCapacity = 200,
      transactionLimit = 300,
      userBalance = 100
    renderDepositForm(backerLimit, transactionLimit, userBalance, remainingCapacity)
    fireEvent.click(screen.getByText("Supply"))
    fireEvent.click(screen.getByText("Max", {selector: "button"}))

    await waitFor(() => {
      expect(screen.getByPlaceholderText("0")).toHaveProperty("value", userBalance.toString())
    })
  })

  it("fills the transaction amount with the transaction limit", async () => {
    let backerLimit = 500,
      remainingCapacity = 200,
      transactionLimit = 100,
      userBalance = 400
    renderDepositForm(backerLimit, transactionLimit, userBalance, remainingCapacity)
    fireEvent.click(screen.getByText("Supply"))
    fireEvent.click(screen.getByText("Max", {selector: "button"}))

    await waitFor(() => {
      expect(screen.getByPlaceholderText("0")).toHaveProperty("value", transactionLimit.toString())
    })
  })

  it("fills the transaction amount with the remaining limit", async () => {
    let backerLimit = 500,
      remainingCapacity = 100,
      transactionLimit = 200,
      userBalance = 400
    renderDepositForm(backerLimit, transactionLimit, userBalance, remainingCapacity)
    fireEvent.click(screen.getByText("Supply"))
    fireEvent.click(screen.getByText("Max", {selector: "button"}))

    await waitFor(() => {
      expect(screen.getByPlaceholderText("0")).toHaveProperty("value", remainingCapacity.toString())
    })
  })

  it("has no more than 6 digital places", async () => {
    let backerLimit = 500,
      remainingCapacity = 300,
      transactionLimit = 200,
      userBalance = 100.98098978
    renderDepositForm(backerLimit, transactionLimit, userBalance, remainingCapacity)
    fireEvent.click(screen.getByText("Supply"))
    fireEvent.click(screen.getByText("Max", {selector: "button"}))

    await waitFor(() => {
      expect(screen.getByPlaceholderText("0")).toHaveProperty("value", "100.980989")
    })
  })
})
