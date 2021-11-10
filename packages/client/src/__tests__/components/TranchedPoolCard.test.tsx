import "@testing-library/jest-dom"
import {AppContext} from "../../App"
import {render, screen, waitFor} from "@testing-library/react"
import {TranchedPoolCard} from "../../components/earn"
import {defaultCreditLine} from "../../ethereum/creditLine"
import BigNumber from "bignumber.js"
import {TranchedPoolMetadata, TranchedPool} from "../../ethereum/tranchedPool"
import {GoldfinchProtocol} from "../../ethereum/GoldfinchProtocol"

function renderTranchedPoolCard(
  userAddress: string,
  isPaused: boolean,
  remainingCapacity: BigNumber,
  maxBackers: number | undefined,
  backers: string[] | undefined
) {
  // Mock tranched pool.
  const tranchedPool = new TranchedPool("0xasdf", {
    getContract: () => {
      return
    },
  } as unknown as GoldfinchProtocol)
  tranchedPool.creditLine = defaultCreditLine as any
  tranchedPool.remainingCapacity = () => remainingCapacity
  tranchedPool.metadata = {maxBackers} as TranchedPoolMetadata
  tranchedPool.isPaused = isPaused

  const poolBacker = {
    address: userAddress,
    tranchedPool,
    tokenInfos: ["info"],
  }

  const store = {
    user: undefined as any,
  }

  return render(
    <AppContext.Provider value={store}>
      <TranchedPoolCard poolBacker={poolBacker as any} backers={backers} disabled={false} />
    </AppContext.Provider>
  )
}

describe("Tranched pool card", () => {
  const maxBackers = 2

  describe("pool is paused", () => {
    it("should show paused badge", async () => {
      renderTranchedPoolCard("", true, new BigNumber(0), maxBackers, undefined)

      await waitFor(() => {
        expect(screen.getByText("Paused")).toBeInTheDocument()
      })
    })
  })
  describe("pool is not paused", () => {
    describe("remaining capacity is 0", () => {
      describe("has participation limits", () => {
        it("should show full badge", async () => {
          renderTranchedPoolCard("", false, new BigNumber(0), maxBackers, undefined)

          await waitFor(() => {
            expect(screen.getByText("Full")).toBeInTheDocument()
          })
        })
      })
      describe("does not have participation limits", () => {
        it("should show full badge", async () => {
          renderTranchedPoolCard("", false, new BigNumber(0), undefined, undefined)

          await waitFor(() => {
            expect(screen.getByText("Full")).toBeInTheDocument()
          })
        })
      })
    })
    describe("remaining capacity is not 0", () => {
      describe("has participation limits", () => {
        describe("backers are defined", () => {
          describe("number of backers has reached limit", () => {
            describe("user with address", () => {
              describe("user is a participant", () => {
                it("should show open badge", async () => {
                  renderTranchedPoolCard("0xtest", false, new BigNumber(100), maxBackers, ["0xtest", "0xfoo"])

                  await waitFor(() => {
                    expect(screen.getByText("Open")).toBeInTheDocument()
                  })
                })
              })
              describe("user is not a participant", () => {
                it("should show full badge", async () => {
                  renderTranchedPoolCard("0xtest", false, new BigNumber(100), maxBackers, ["0xfoo", "0xbar"])

                  await waitFor(() => {
                    expect(screen.getByText("Full")).toBeInTheDocument()
                  })
                })
              })
            })
            describe("user without address", () => {
              it("should show full badge", async () => {
                renderTranchedPoolCard("", false, new BigNumber(100), maxBackers, ["0xfoo", "0xbar"])

                await waitFor(() => {
                  expect(screen.getByText("Full")).toBeInTheDocument()
                })
              })
            })
          })
          describe("number of backers is under limit", () => {
            describe("user with address", () => {
              describe("user is a participant", () => {
                it("should show open badge", async () => {
                  renderTranchedPoolCard("0xtest", false, new BigNumber(100), maxBackers, ["0xtest"])

                  await waitFor(() => {
                    expect(screen.getByText("Open")).toBeInTheDocument()
                  })
                })
              })
              describe("user is not a participant", () => {
                it("should show open badge", async () => {
                  renderTranchedPoolCard("0xtest", false, new BigNumber(100), maxBackers, ["0xfoo"])

                  await waitFor(() => {
                    expect(screen.getByText("Open")).toBeInTheDocument()
                  })
                })
              })
            })
            describe("user without address", () => {
              it("should show open badge", async () => {
                renderTranchedPoolCard("", false, new BigNumber(100), maxBackers, ["0xfoo"])

                await waitFor(() => {
                  expect(screen.getByText("Open")).toBeInTheDocument()
                })
              })
            })
          })
        })
        describe("backers are undefined", () => {
          describe("user with address", () => {
            it("should not show a badge", async () => {
              renderTranchedPoolCard("0xtest", false, new BigNumber(100), maxBackers, undefined)

              await waitFor(() => {
                expect(screen.queryByText("Open")).toBeNull()
                expect(screen.queryByText("Full")).toBeNull()
              })
            })
          })
          describe("user without address", () => {
            it("should not show a badge", async () => {
              renderTranchedPoolCard("", false, new BigNumber(100), maxBackers, undefined)

              await waitFor(() => {
                expect(screen.queryByText("Open")).toBeNull()
                expect(screen.queryByText("Full")).toBeNull()
              })
            })
          })
        })
      })
      describe("does not have participation limits", () => {
        it("should show open badge", async () => {
          renderTranchedPoolCard("", false, new BigNumber(100), undefined, undefined)

          await waitFor(() => {
            expect(screen.getByText("Open")).toBeInTheDocument()
          })
        })
      })
    })
  })
})
