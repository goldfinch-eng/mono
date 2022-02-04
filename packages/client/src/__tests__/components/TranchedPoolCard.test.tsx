import "@testing-library/jest-dom"
import {AppContext} from "../../App"
import {render, screen, waitFor} from "@testing-library/react"
import TranchedPoolCard from "../../components/Earn/TranchedPoolCard"
import {defaultCreditLine} from "../../ethereum/creditLine"
import BigNumber from "bignumber.js"
import {TranchedPool, TranchedPoolBacker} from "../../ethereum/tranchedPool"
import {GoldfinchProtocol} from "../../ethereum/GoldfinchProtocol"

function renderTranchedPoolCard(
  isPaused: boolean,
  remainingCapacity: BigNumber,
  isRepaid: boolean,
  poolEstimatedBackersOnlyApyFromGfi: BigNumber | undefined
) {
  // Mock tranched pool.
  const tranchedPool = new TranchedPool("0xasdf", {
    getContract: () => {
      return
    },
  } as unknown as GoldfinchProtocol)
  tranchedPool.creditLine = defaultCreditLine as any
  tranchedPool.remainingCapacity = () => remainingCapacity
  tranchedPool.isPaused = isPaused
  Object.defineProperty(tranchedPool, "isRepaid", {
    get: () => isRepaid,
  })
  tranchedPool.estimatedLeverageRatio = new BigNumber(4)
  tranchedPool.estimateJuniorAPY = (v) => new BigNumber("0.085")

  const poolBacker = {
    tranchedPool,
    tokenInfos: ["info"],
  }

  const store = {
    user: undefined,
  }

  return render(
    <AppContext.Provider value={store}>
      <TranchedPoolCard
        poolBacker={poolBacker as unknown as TranchedPoolBacker}
        poolEstimatedBackersOnlyApyFromGfi={poolEstimatedBackersOnlyApyFromGfi}
        disabled={false}
      />
    </AppContext.Provider>
  )
}

describe("Tranched pool card", () => {
  describe("Badge", () => {
    describe("pool is paused", () => {
      describe("remaining capacity is 0", () => {
        it("should show paused badge", async () => {
          renderTranchedPoolCard(true, new BigNumber(0), false, undefined)

          await waitFor(() => {
            expect(screen.getByText("Paused")).toBeInTheDocument()
          })
        })
      })
      describe("remaining capacity is not 0", () => {
        it("should show paused badge", async () => {
          renderTranchedPoolCard(true, new BigNumber(100), false, undefined)

          await waitFor(() => {
            expect(screen.getByText("Paused")).toBeInTheDocument()
          })
        })
      })
      describe("is repaid", () => {
        it("should show the paused badge", async () => {
          renderTranchedPoolCard(true, new BigNumber(100), true, undefined)

          await waitFor(() => {
            expect(screen.getByText("Paused")).toBeInTheDocument()
          })
        })
      })
    })
    describe("pool is not paused", () => {
      describe("remaining capacity is 0", () => {
        it("should show full badge", async () => {
          renderTranchedPoolCard(false, new BigNumber(0), false, undefined)

          await waitFor(() => {
            expect(screen.getByText("Full")).toBeInTheDocument()
          })
        })
      })
      describe("remaining capacity is not 0", () => {
        it("should show open badge", async () => {
          renderTranchedPoolCard(false, new BigNumber(100), false, undefined)

          await waitFor(() => {
            expect(screen.getByText("Open")).toBeInTheDocument()
          })
        })
      })
      describe("has been repaid", async () => {
        it("shows the repaid badge", async () => {
          renderTranchedPoolCard(false, new BigNumber(100), true, undefined)
          await waitFor(() => {
            expect(screen.getByText("Repaid")).toBeInTheDocument()
          })
        })
      })
    })
  })
  describe("Estimated APY", () => {
    it("shows only the pool's base APY, if APY-from-GFI is undefined", async () => {
      renderTranchedPoolCard(false, new BigNumber(0), false, undefined)

      await waitFor(() => {
        expect(screen.getByText("8.50%")).toBeInTheDocument()
      })
    })
    it("shows the sum of base APY and APY-from-GFI, if APY-from-GFI is defined", async () => {
      renderTranchedPoolCard(true, new BigNumber(0), false, new BigNumber(0.9))

      await waitFor(() => {
        expect(screen.getByText("98.50%")).toBeInTheDocument()
      })
    })
  })
})
