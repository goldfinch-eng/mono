import "@testing-library/jest-dom"
import {AppContext} from "../../App"
import {render, screen, fireEvent} from "@testing-library/react"
import NetworkWidget from "../../components/networkWidget"
import * as utils from "../../utils"

function renderNetworkWidget(sessionData, address) {
  let store = {
    network: {
      name: "localhost",
      supported: true,
    },
    user: {
      address: address,
      loaded: true,
      web3Connected: true,
    },
    sessionData: sessionData,
    setSessionData: () => {},
  }

  return render(
    // @ts-expect-error ts-migrate(2322) FIXME: Type '{ network: { name: string; supported: boolea... Remove this comment to see the full error message
    <AppContext.Provider value={store}>
      <NetworkWidget
        // @ts-expect-error ts-migrate(2322) FIXME: Type '{ loaded: boolean; web3Connected: boolean; }... Remove this comment to see the full error message
        user={store.user}
        network={store.network}
        currentErrors={[]}
        currentTXs={[]}
        connectionComplete={() => {}}
      />
    </AppContext.Provider>
  )
}

describe("network widget sign in", () => {
  it("shows modal with terms of service", async () => {
    ;(global.window as any).ethereum = jest.fn()
    ;(global.window as any).ethereum.request = () => {
      return Promise.resolve()
    }
    renderNetworkWidget(undefined, "0x000")

    // @ts-expect-error ts-migrate(2345) FIXME: Argument of type 'HTMLElement | undefined' is not ... Remove this comment to see the full error message
    fireEvent.click(screen.getAllByText("Connect Metamask")[0])
    expect(screen.getByText("Terms of Service")).toBeInTheDocument()
  })

  it("shows connect with metamask if session data is invalid", async () => {
    global.window.ethereum = jest.fn()
    global.window.ethereum.request = () => {
      return Promise.resolve()
    }
    renderNetworkWidget(undefined, "0x000")
    expect(screen.getAllByText("Connect Metamask")[0]).toBeInTheDocument()
  })

  it("shows signed in with correct session data", async () => {
    global.window.ethereum = jest.fn()
    global.window.ethereum.request = () => {
      return Promise.resolve()
    }
    const spy = jest.spyOn(utils, "secondsSinceEpoch")
    spy.mockReturnValue(1631996519)

    renderNetworkWidget(
      {signature: "foo", signatureBlockNum: 42, signatureBlockNumTimestamp: 1631996519, version: 1},
      "0x000"
    )
    expect(screen.getByText("USDC balance")).toBeInTheDocument()
  })

  it("shows signed in when user has session data but address doesn't exist", async () => {
    global.window.ethereum = jest.fn()
    global.window.ethereum.request = () => {
      return Promise.resolve()
    }

    const spy = jest.spyOn(utils, "secondsSinceEpoch")
    spy.mockReturnValue(1631996519)

    renderNetworkWidget(
      {signature: "foo", signatureBlockNum: 42, signatureBlockNumTimestamp: 1631996519, version: 1},
      ""
    )
    expect(screen.getAllByText("Connect Metamask")[0]).toBeInTheDocument()
  })

  it("shows connect with metamask with missing signature", async () => {
    global.window.ethereum = jest.fn()
    global.window.ethereum.request = () => {
      return Promise.resolve()
    }
    renderNetworkWidget({signatureBlockNum: 42, signatureBlockNumTimestamp: 47}, "0x000")
    expect(screen.getAllByText("Connect Metamask")[0]).toBeInTheDocument()
  })
})
