import "@testing-library/jest-dom"
import {AppContext} from "../../App"
import {render, screen, fireEvent} from "@testing-library/react"
import NetworkWidget from "../../components/networkWidget"

function renderNetworkWidget() {
  let store = {
    network: {
      name: "localhost",
      supported: true,
    },
    user: {
      loaded: true,
      web3Connected: true,
    },
    sessionData: undefined,
    setSessionData: () => {},
  }

  return render(
    <AppContext.Provider value={store}>
      <NetworkWidget
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
    global.window.ethereum = jest.fn()
    global.window.ethereum.request = () => {
      return Promise.resolve()
    }
    renderNetworkWidget()

    fireEvent.click(screen.getAllByText("Connect Metamask")[0])
    expect(screen.getByText("Terms of Service")).toBeInTheDocument()
  })
})
