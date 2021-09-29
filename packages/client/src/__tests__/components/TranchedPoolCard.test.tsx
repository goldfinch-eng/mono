import "@testing-library/jest-dom"
import {AppContext} from "../../App"
import {render, screen, waitFor} from "@testing-library/react"
import {defaultUser} from "../../ethereum/user"
import {TranchedPoolCard} from "../../components/earn"
import {defaultCreditLine} from "../../ethereum/creditLine"
import BigNumber from "bignumber.js"

function renderTranchedPoolCard(remainingCapacity) {
  const poolBacker = {
    tranchedPool: {
      creditLine: defaultCreditLine,
      remainingCapacity: () => new BigNumber(remainingCapacity),
    },
    tokenInfos: ["info"],
  }

  const store = {
    user: defaultUser(),
  }

  return render(
    <AppContext.Provider value={store}>
      <TranchedPoolCard poolBacker={poolBacker as any} />
    </AppContext.Provider>,
  )
}

describe("Tranched pool card", () => {
  it("should show open badge", async () => {
    renderTranchedPoolCard(new BigNumber(100))

    await waitFor(() => {
      expect(screen.getByText("Open")).toBeInTheDocument()
    })
  })

  it("should show full badge", async () => {
    renderTranchedPoolCard(new BigNumber(0))

    await waitFor(() => {
      expect(screen.getByText("Full")).toBeInTheDocument()
    })
  })
})
