import _ from "lodash"
import BigNumber from "bignumber.js"
import {AppContext} from "../App"
import DepositForm from "./depositForm"
import {render, screen, fireEvent, waitFor} from "@testing-library/react"
import {usdcToAtomic} from "../ethereum/erc20"

function renderDepositForm(transactionLimit, userBalance, remainingCapacity) {
  let store = {
    goldfinchConfig: {
      transactionLimit: new BigNumber(usdcToAtomic(transactionLimit)),
    },
    user: {
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
          },
        },
      },
    },
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
    let remainingCapacity = 300,
      transactionLimit = 200,
      userBalance = 100
    renderDepositForm(transactionLimit, userBalance, remainingCapacity)
    fireEvent.click(screen.getByText("Supply"))
    fireEvent.click(screen.getByText("Max", {selector: "button"}))

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toHaveProperty("value", userBalance.toString())
    })
  })

  it("fills the transaction amount with the transaction limit", async () => {
    let remainingCapacity = 300,
      transactionLimit = 200,
      userBalance = 500
    renderDepositForm(transactionLimit, userBalance, remainingCapacity)
    fireEvent.click(screen.getByText("Supply"))
    fireEvent.click(screen.getByText("Max", {selector: "button"}))

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toHaveProperty("value", transactionLimit.toString())
    })
  })

  it("fills the transaction amount with the remaining limit", async () => {
    let remainingCapacity = 300,
      transactionLimit = 400,
      userBalance = 500
    renderDepositForm(transactionLimit, userBalance, remainingCapacity)
    fireEvent.click(screen.getByText("Supply"))
    fireEvent.click(screen.getByText("Max", {selector: "button"}))

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toHaveProperty("value", remainingCapacity.toString())
    })
  })

  it("has no more than 6 digital places", async () => {
    let remainingCapacity = 300,
      transactionLimit = 200,
      userBalance = 100.98098978
    renderDepositForm(transactionLimit, userBalance, remainingCapacity)
    fireEvent.click(screen.getByText("Supply"))
    fireEvent.click(screen.getByText("Max", {selector: "button"}))

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toHaveProperty("value", "100.980989")
    })
  })
})
