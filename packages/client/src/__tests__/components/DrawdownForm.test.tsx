import _ from "lodash"
import BigNumber from "bignumber.js"
import {AppContext} from "../../App"
import DrawdownForm from "../../components/Borrow/DrawdownForm"
import {render, screen, fireEvent, waitFor} from "@testing-library/react"
import {usdcToAtomic} from "../../ethereum/erc20"

function renderDrawdownForm(transactionLimit, creditLineBalance, seniorPoolremainingCapacity) {
  const mockAddress = "0x0000000000000000000000000"
  creditLineBalance = new BigNumber(creditLineBalance)

  let store = {
    goldfinchConfig: {
      transactionLimit: new BigNumber(usdcToAtomic(transactionLimit)),
    },
    creditLine: {
      availableCreditInDollars: creditLineBalance,
    },
    pool: {
      gf: {
        remainingCapacity: () => new BigNumber(usdcToAtomic(seniorPoolremainingCapacity)),
        totalPoolAssets: new BigNumber(0),
      },
    },
    network: {
      name: "mainnet",
    },
  }
  return render(
    // @ts-expect-error ts-migrate(2322) FIXME: Type '{ goldfinchConfig: { transactionLimit: BigNu... Remove this comment to see the full error message
    <AppContext.Provider value={store}>
      <DrawdownForm
        actionComplete={_.noop}
        closeForm={_.noop}
        owner={{userAddress: mockAddress}}
        // @ts-expect-error ts-migrate(2322) FIXME: Type '{ borrowerAddress: string; }' is missing... Remove this comment to see the full error message
        borrower={{borrowerAddress: mockAddress}}
        // @ts-expect-error ts-migrate(2322) FIXME: Type '{ availableCreditInDollars: any; }' is missing... Remove this comment to see the full error message
        creditLine={{availableCreditInDollars: creditLineBalance}}
      />
    </AppContext.Provider>
  )
}

describe("max transaction amount for drawdownForm", () => {
  it("fills the transaction amount with the credit line balance", async () => {
    let seniorPoolremainingCapacity = 300,
      transactionLimit = 200,
      creditLineBalance = 100
    renderDrawdownForm(transactionLimit, creditLineBalance, seniorPoolremainingCapacity)
    fireEvent.click(screen.getByText("Borrow"))
    fireEvent.click(screen.getByText("Max", {selector: "button"}))

    await waitFor(() => {
      expect(screen.getAllByRole("textbox")[1]).toHaveProperty("value", creditLineBalance.toString())
    })
  })

  it("fills the transaction amount with the transaction limit", async () => {
    let seniorPoolremainingCapacity = 300,
      transactionLimit = 200,
      creditLineBalance = 500
    renderDrawdownForm(transactionLimit, creditLineBalance, seniorPoolremainingCapacity)
    fireEvent.click(screen.getByText("Borrow"))
    fireEvent.click(screen.getByText("Max", {selector: "button"}))

    expect(screen.getAllByRole("textbox")[1]).toHaveProperty("value", transactionLimit.toString())
  })

  it("is not limited by the senior pool remaining capacity", async () => {
    let seniorPoolremainingCapacity = 300,
      transactionLimit = 400,
      creditLineBalance = 500
    renderDrawdownForm(transactionLimit, creditLineBalance, seniorPoolremainingCapacity)
    fireEvent.click(screen.getByText("Borrow"))
    fireEvent.click(screen.getByText("Max", {selector: "button"}))

    await waitFor(() => {
      expect(screen.getAllByRole("textbox")[1]).toHaveProperty("value", transactionLimit.toString())
    })
  })
})
