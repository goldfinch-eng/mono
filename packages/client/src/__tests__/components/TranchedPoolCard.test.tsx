import "@testing-library/jest-dom"
import {AppContext} from "../../App"
import {render, screen, waitFor} from "@testing-library/react"
import TranchedPoolCard from "../../components/Earn/TranchedPoolCard"
import BigNumber from "bignumber.js"
import {TranchedPool, TranchedPoolBacker} from "../../ethereum/tranchedPool"
import {GoldfinchProtocol} from "../../ethereum/GoldfinchProtocol"
import {CreditLine} from "../../ethereum/creditLine"

function renderTranchedPoolCard(
  isPaused: boolean,
  remainingCapacity: BigNumber,
  isRepaid: boolean,
  poolEstimatedBackersOnlyApyFromGfi: BigNumber | undefined,
  poolEstimatedSeniorPoolMatchingApyFromGfi: BigNumber | undefined,
  creditLineTermEndTime: BigNumber
) {
  // Mock tranched pool.
  const tranchedPool = new TranchedPool("0xasdf", {
    getContract: () => {
      return
    },
  } as unknown as GoldfinchProtocol)
  tranchedPool.creditLine = {} as CreditLine
  tranchedPool.creditLine.termEndTime = creditLineTermEndTime
  tranchedPool.fundableAt = new BigNumber(1644858313)
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
    getAllTokenInfos: () => ["info"],
  }

  const store = {
    user: undefined,
    currentBlock: {
      number: 0,
      timestamp: 1644857965,
    },
  }

  return render(
    <AppContext.Provider value={store}>
      <TranchedPoolCard
        poolBacker={poolBacker as unknown as TranchedPoolBacker}
        poolEstimatedBackersOnlyApyFromGfi={poolEstimatedBackersOnlyApyFromGfi}
        poolEstimatedSeniorPoolMatchingApyFromGfi={poolEstimatedSeniorPoolMatchingApyFromGfi}
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
          renderTranchedPoolCard(true, new BigNumber(0), false, undefined, undefined, new BigNumber(0))

          await waitFor(() => {
            expect(screen.getByText("Paused")).toBeInTheDocument()
          })
        })
      })
      describe("remaining capacity is not 0", () => {
        it("should show paused badge", async () => {
          renderTranchedPoolCard(true, new BigNumber(100), false, undefined, undefined, new BigNumber(0))

          await waitFor(() => {
            expect(screen.getByText("Paused")).toBeInTheDocument()
          })
        })
      })
      describe("is repaid", () => {
        it("should show the paused badge", async () => {
          renderTranchedPoolCard(true, new BigNumber(100), true, undefined, undefined, new BigNumber(0))

          await waitFor(() => {
            expect(screen.getByText("Paused")).toBeInTheDocument()
          })
        })
      })
    })
    describe("pool is not paused", () => {
      describe("remaining capacity is 0", () => {
        it("should show full badge", async () => {
          renderTranchedPoolCard(false, new BigNumber(0), false, undefined, undefined, new BigNumber(0))

          await waitFor(() => {
            expect(screen.getByText("Full")).toBeInTheDocument()
          })
        })
      })
      describe("remaining capacity is not 0", () => {
        it("should show open badge", async () => {
          renderTranchedPoolCard(false, new BigNumber(100), false, undefined, undefined, new BigNumber(2))

          await waitFor(() => {
            expect(screen.getByText("Open")).toBeInTheDocument()
          })
        })
      })
      describe("remaining capacity is not 0", () => {
        it("should show coming soon badge", async () => {
          renderTranchedPoolCard(false, new BigNumber(100), false, undefined, undefined, new BigNumber(0))

          await waitFor(() => {
            expect(screen.getByText("Coming Soon")).toBeInTheDocument()
          })
        })
      })
      describe("has been repaid", () => {
        it("shows the repaid badge", async () => {
          renderTranchedPoolCard(false, new BigNumber(100), true, undefined, undefined, new BigNumber(0))
          await waitFor(() => {
            expect(screen.getByText("Repaid")).toBeInTheDocument()
          })
        })
      })
    })
  })
  describe("Estimated APY", () => {
    it("shows only the pool's base APY, if the senior-pool-matching APY-from-GFI and the backers-only APY-from-GFI are undefined", async () => {
      renderTranchedPoolCard(false, new BigNumber(0), false, undefined, undefined, new BigNumber(0))

      await waitFor(() => {
        expect(screen.getByText("8.50% USDC")).toBeInTheDocument()
        expect(screen.getByText("8.50% with GFI")).toBeInTheDocument()
      })
    })
    it("shows the sum of base APY and the senior-pool-matching APY-from-GFI, if the backers-only APY-from-GFI is undefined", async () => {
      renderTranchedPoolCard(false, new BigNumber(0), false, undefined, new BigNumber(0.2), new BigNumber(0))

      await waitFor(() => {
        expect(screen.getByText("8.50% USDC")).toBeInTheDocument()
        expect(screen.getByText("28.50% with GFI")).toBeInTheDocument()
      })
    })
    it("shows the sum of base APY, the senior-pool-matching APY-from-GFI, and the backers-only APY-from-GFI, if the latter two are defined", async () => {
      renderTranchedPoolCard(true, new BigNumber(0), false, new BigNumber(0.9), new BigNumber(0.2), new BigNumber(0))

      await waitFor(() => {
        expect(screen.getByText("8.50% USDC")).toBeInTheDocument()
        expect(screen.getByText("118.50% with GFI")).toBeInTheDocument()
      })
    })
  })
})
