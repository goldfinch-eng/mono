import "@testing-library/jest-dom"
import {AppContext} from "../../App"
import {render, screen, waitFor} from "@testing-library/react"
import {SeniorPoolCard} from "../../components/earn"
import BigNumber from "bignumber.js"

function renderSeniorPoolCard(remainingCapacity: BigNumber | undefined) {
  const props = {
    balance: "100",
    userBalance: "200",
    apy: "10",
    limit: "300",
    remainingCapacity: remainingCapacity,
    disabled: false,
    userBalanceDisabled: false,
  }

  const store = {
    user: undefined,
  }

  return render(
    <AppContext.Provider value={store}>
      <SeniorPoolCard {...props} />
    </AppContext.Provider>
  )
}

describe("Senior pool card", () => {
  it("should show open badge", async () => {
    renderSeniorPoolCard(new BigNumber(100))

    await waitFor(() => {
      expect(screen.getByText("Open")).toBeInTheDocument()
    })
  })

  it("should show full badge", async () => {
    renderSeniorPoolCard(new BigNumber(0))

    await waitFor(() => {
      expect(screen.getByText("Full")).toBeInTheDocument()
    })
  })
})
