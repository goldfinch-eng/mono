import "@testing-library/jest-dom"
import {AppContext} from "../../App"
import {render, screen, waitFor} from "@testing-library/react"
import {defaultUser} from "../../ethereum/user"
import {SeniorPoolCard} from "../../components/earn"
import BigNumber from "bignumber.js"

function renderSeniorPoolCard(remainingCapacity) {
  const props = {
    balance: 100,
    userBalance: 200,
    apy: 10,
    limit: 300,
    remainingCapacity: remainingCapacity,
  }

  const store = {
    user: defaultUser(),
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
