import "@testing-library/jest-dom"
import {AppContext, GlobalState} from "../../App"
import {render, screen, fireEvent} from "@testing-library/react"
import NetworkWidget from "../../components/networkWidget"
import {UserLoaded} from "../../ethereum/user"

function renderNetworkWidget(sessionData, address, userWalletWeb3Status) {
  let store = {
    userWalletWeb3Status: userWalletWeb3Status ?? {
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
  it("shows metamask btn and I don't have a wallet btn", async () => {
    renderNetworkWidget(undefined, undefined, {
      type: "no_web3",
      networkName: undefined,
      address: undefined,
    })
    expect(screen.getByText("MetaMask")).toBeInTheDocument()
    expect(screen.getByAltText("WalletConnect Logo")).toBeInTheDocument()
    expect(screen.getByText("I don't have a wallet")).toBeInTheDocument()
  })

  it("shows modal with: you don’t have Metamask installed", async () => {
    renderNetworkWidget(undefined, undefined, {
      type: "no_web3",
      networkName: "localhost",
      address: undefined,
    })
    fireEvent.click(screen.getByText("Connect Wallet"))
    fireEvent.click(screen.getByText("MetaMask"))
    expect(screen.getByText("Looks like you don’t have Metamask installed.", {exact: false})).toBeInTheDocument()
    expect(screen.getByText("Install MetaMask")).toBeInTheDocument()
    expect(screen.getByText("Back to wallets")).toBeInTheDocument()
  })

  it("shows modal with terms of service", async () => {
    renderNetworkWidget(undefined, undefined, {
      type: "has_web3",
      networkName: "localhost",
      address: undefined,
    })
    fireEvent.click(screen.getByText("Connect Wallet"))
    expect(screen.getByText("Terms of Service")).toBeInTheDocument()
    expect(screen.getByText("MetaMask")).toBeInTheDocument()
  })

  it("shows walletConnect modal", async () => {
    renderNetworkWidget(undefined, undefined, {
      type: "has_web3",
      networkName: "localhost",
      address: undefined,
    })

    fireEvent.click(screen.getByText("Connect Wallet"))
    expect(screen.getByText("MetaMask")).toBeInTheDocument()
    expect(screen.getByAltText("WalletConnect Logo")).toBeInTheDocument()
    fireEvent.click(screen.getByAltText("WalletConnect Logo"))
    expect(screen.getByText("Scan with WalletConnect to connect")).toBeInTheDocument()
  })

  it("shows signed in with correct session data", async () => {
    ;(global.window as any).ethereum = jest.fn()
    ;(global.window as any).ethereum.request = () => {
      return Promise.resolve()
    }

    renderNetworkWidget(
      {signature: "foo", signatureBlockNum: 42, signatureBlockNumTimestamp: 1631996519, version: 1},
      "0x000",
      undefined
    )
    expect(screen.getByText("USDC balance")).toBeInTheDocument()
  })

  it("shows connect wallet when user has session data but address doesn't exist", async () => {
    ;(global.window as any).ethereum = jest.fn()
    ;(global.window as any).ethereum.request = () => {
      return Promise.resolve()
    }

    renderNetworkWidget(
      {signature: "foo", signatureBlockNum: 42, signatureBlockNumTimestamp: 1631996519, version: 1},
      "",
      {
        type: "has_web3",
        networkName: "private",
        undefined,
      }
    )
    expect(screen.getByText("Connect Wallet")).toBeInTheDocument()
  })

  it("shows connected state with missing signature", async () => {
    ;(global.window as any).ethereum = jest.fn()
    ;(global.window as any).ethereum.request = () => {
      return Promise.resolve()
    }
    renderNetworkWidget({signatureBlockNum: 42, signatureBlockNumTimestamp: 1631996519}, "0x000", undefined)
    expect(screen.getByText("USDC balance")).toBeInTheDocument()
  })

  it("shows I don't have a wallet button when user is not connected", async () => {
    renderNetworkWidget(undefined, undefined, {
      type: "has_web3",
      networkName: "localhost",
      address: undefined,
    })
    expect(screen.getByText("I don't have a wallet")).toBeInTheDocument()
  })

  it("shows Install MetaMask suggestion when user is not connected", async () => {
    renderNetworkWidget(undefined, undefined, {
      type: "has_web3",
      networkName: "localhost",
      address: undefined,
    })
    fireEvent.click(screen.getByText("I don't have a wallet"))
    expect(screen.getByText("Install MetaMask")).toBeInTheDocument()
    expect(screen.getByText("Back to wallets")).toBeInTheDocument()
  })

  it("shows Add GFI token to wallet when user is connected", async () => {
    ;(global.window as any).ethereum = jest.fn()
    ;(global.window as any).ethereum.request = () => {
      return Promise.resolve()
    }

    renderNetworkWidget(
      {signature: "foo", signatureBlockNum: 42, signatureBlockNumTimestamp: 1631996519, version: 1},
      "0x000",
      undefined
    )
    expect(screen.getByText("Add GFI token to wallet")).toBeInTheDocument()
  })
})
