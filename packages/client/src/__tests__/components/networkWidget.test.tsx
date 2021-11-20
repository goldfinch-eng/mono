import "@testing-library/jest-dom"
import {AppContext, GlobalState} from "../../App"
import {render, screen, fireEvent} from "@testing-library/react"
import NetworkWidget from "../../components/networkWidget"
import {UserLoaded} from "../../ethereum/user"

function renderNetworkWidget(sessionData, address) {
  let store = {
    web3Status: {
      type: "connected",
      networkName: "localhost",
      address,
    },
    network: {
      name: "localhost",
      supported: true,
    },
    user: {
      address,
      info: {
        loaded: true,
        value: {},
      },
    },
    sessionData: sessionData,
    setSessionData: () => {},
    currentBlock: {
      number: 42,
      timestamp: 1631996519,
    },
  }

  return render(
    <AppContext.Provider value={store as unknown as GlobalState}>
      <NetworkWidget
        currentBlock={store.currentBlock}
        user={store.user as UserLoaded}
        network={store.network}
        currentErrors={[]}
        currentTxs={[]}
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
    ;(global.window as any).ethereum = jest.fn()
    ;(global.window as any).ethereum.request = () => {
      return Promise.resolve()
    }
    renderNetworkWidget(undefined, "0x000")
    expect(screen.getAllByText("Connect Metamask")[0]).toBeInTheDocument()
  })

  it("shows signed in with correct session data", async () => {
    ;(global.window as any).ethereum = jest.fn()
    ;(global.window as any).ethereum.request = () => {
      return Promise.resolve()
    }

    renderNetworkWidget(
      {signature: "foo", signatureBlockNum: 42, signatureBlockNumTimestamp: 1631996519, version: 1},
      "0x000"
    )
    expect(screen.getByText("USDC balance")).toBeInTheDocument()
  })

  it("shows signed in when user has session data but address doesn't exist", async () => {
    ;(global.window as any).ethereum = jest.fn()
    ;(global.window as any).ethereum.request = () => {
      return Promise.resolve()
    }

    renderNetworkWidget(
      {signature: "foo", signatureBlockNum: 42, signatureBlockNumTimestamp: 1631996519, version: 1},
      ""
    )
    expect(screen.getAllByText("Connect Metamask")[0]).toBeInTheDocument()
  })

  it("shows connect with metamask with missing signature", async () => {
    ;(global.window as any).ethereum = jest.fn()
    ;(global.window as any).ethereum.request = () => {
      return Promise.resolve()
    }
    renderNetworkWidget({signatureBlockNum: 42, signatureBlockNumTimestamp: 1631996519}, "0x000")
    expect(screen.getAllByText("Connect Metamask")[0]).toBeInTheDocument()
  })
})
