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
  remainingCapacity: BigNumber,
  maxParticipants: number | undefined,
  participants: string[] | undefined
) {
  // Mock tranched pool.
  const tranchedPool = new TranchedPool("0xasdf", {
    getContract: () => {
      return
    },
  } as unknown as GoldfinchProtocol)
  tranchedPool.creditLine = defaultCreditLine as any
  tranchedPool.remainingCapacity = () => remainingCapacity
  tranchedPool.metadata = {maxParticipants} as TranchedPoolMetadata

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
      <TranchedPoolCard poolBacker={poolBacker as any} participants={participants} disabled={false} />
    </AppContext.Provider>
  )
}

describe("Tranched pool card", () => {
  const maxParticipants = 2

  describe("remaining capacity is 0", () => {
    describe("has participation limits", () => {
      it("should show full badge", async () => {
        renderTranchedPoolCard("", new BigNumber(0), maxParticipants, undefined)

        await waitFor(() => {
          expect(screen.getByText("Full")).toBeInTheDocument()
        })
      })
    })
    describe("does not have participation limits", () => {
      it("should show full badge", async () => {
        renderTranchedPoolCard("", new BigNumber(0), undefined, undefined)

        await waitFor(() => {
          expect(screen.getByText("Full")).toBeInTheDocument()
        })
      })
    })
  })
  describe("remaining capacity is not 0", () => {
    describe("has participation limits", () => {
      describe("participants are defined", () => {
        describe("number of participants has reached limit", () => {
          describe("user with address", () => {
            describe("user is a participant", () => {
              it("should show open badge", async () => {
                renderTranchedPoolCard("0xtest", new BigNumber(100), maxParticipants, ["0xtest", "0xfoo"])

                await waitFor(() => {
                  expect(screen.getByText("Open")).toBeInTheDocument()
                })
              })
            })
            describe("user is not a participant", () => {
              it("should show full badge", async () => {
                renderTranchedPoolCard("0xtest", new BigNumber(100), maxParticipants, ["0xfoo", "0xbar"])

                await waitFor(() => {
                  expect(screen.getByText("Full")).toBeInTheDocument()
                })
              })
            })
          })
          describe("user without address", () => {
            it("should show full badge", async () => {
              renderTranchedPoolCard("", new BigNumber(100), maxParticipants, ["0xfoo", "0xbar"])

              await waitFor(() => {
                expect(screen.getByText("Full")).toBeInTheDocument()
              })
            })
          })
        })
        describe("number of participants is under limit", () => {
          describe("user with address", () => {
            describe("user is a participant", () => {
              it("should show open badge", async () => {
                renderTranchedPoolCard("0xtest", new BigNumber(100), maxParticipants, ["0xtest"])

                await waitFor(() => {
                  expect(screen.getByText("Open")).toBeInTheDocument()
                })
              })
            })
            describe("user is not a participant", () => {
              it("should show open badge", async () => {
                renderTranchedPoolCard("0xtest", new BigNumber(100), maxParticipants, ["0xfoo"])

                await waitFor(() => {
                  expect(screen.getByText("Open")).toBeInTheDocument()
                })
              })
            })
          })
          describe("user without address", () => {
            it("should show open badge", async () => {
              renderTranchedPoolCard("", new BigNumber(100), maxParticipants, ["0xfoo"])

              await waitFor(() => {
                expect(screen.getByText("Open")).toBeInTheDocument()
              })
            })
          })
        })
      })
      describe("participants are undefined", () => {
        describe("user with address", () => {
          it("should not show a badge", async () => {
            renderTranchedPoolCard("0xtest", new BigNumber(100), maxParticipants, undefined)

            await waitFor(() => {
              expect(screen.queryByText("Open")).toBeNull()
              expect(screen.queryByText("Full")).toBeNull()
            })
          })
        })
        describe("user without address", () => {
          it("should not show a badge", async () => {
            renderTranchedPoolCard("", new BigNumber(100), maxParticipants, undefined)

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
        renderTranchedPoolCard("", new BigNumber(100), undefined, undefined)

        await waitFor(() => {
          expect(screen.getByText("Open")).toBeInTheDocument()
        })
      })
    })
  })
})
