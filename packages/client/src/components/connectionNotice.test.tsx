import "@testing-library/jest-dom"
import {Matcher, render, screen} from "@testing-library/react"
import _ from "lodash"
import React from "react"
import {MemoryRouter} from "react-router-dom"
import {AppContext, GlobalState} from "../App"
import {CreditLine, defaultCreditLine} from "../ethereum/creditLine"
import {getERC20, Tickers} from "../ethereum/erc20"
import {GoldfinchProtocol} from "../ethereum/GoldfinchProtocol"
import {UserLoaded} from "../ethereum/user"
import {AsyncResult} from "../hooks/useAsync"
import {KYC} from "../hooks/useGoldfinchClient"
import {SessionData} from "../types/session"
import {Web3Status} from "../types/web3"
import ConnectionNotice, {ConnectionNoticeProps, strategies} from "./connectionNotice"

interface Scenario {
  devName: string
  setUpMatch: ({store, props, context}: {store: GlobalState; props: ConnectionNoticeProps; context: Context}) => void
  setUpFallthrough: ({
    store,
    props,
    context,
  }: {
    store: GlobalState
    props: ConnectionNoticeProps
    context: Context
  }) => void
  expectedText: Matcher
}

const testUserAddress = "0xtest"
const noWeb3: Web3Status = {
  type: "no_web3",
  networkName: undefined,
  address: undefined,
}
const hasWeb3: Web3Status = {
  type: "has_web3",
  networkName: "localhost",
  address: undefined,
}
const connected: Web3Status = {
  type: "connected",
  networkName: "localhost",
  address: testUserAddress,
}

const scenarios: Scenario[] = [
  {
    devName: "install_metamask",
    setUpMatch: ({store}) => {
      store.web3Status = noWeb3
    },
    setUpFallthrough: ({store}) => {
      store.web3Status = hasWeb3
    },
    expectedText: /you'll first need to download and install the Metamask plug-in/,
  },
  {
    devName: "wrong_network",
    setUpMatch: ({store}) => {
      store.network = {
        name: "localhost",
        supported: false,
      }
    },
    setUpFallthrough: ({store}) => {
      store.network = {
        name: "localhost",
        supported: true,
      }
    },
    expectedText: /It looks like you aren't on the right Ethereum network/,
  },
  {
    devName: "not_connected_to_metamask",
    setUpMatch: ({store}) => {
      store.web3Status = hasWeb3
    },
    setUpFallthrough: ({store}) => {
      store.web3Status = connected
      store.user = {
        address: testUserAddress,
        info: {loaded: true, value: {goListed: false}},
      } as UserLoaded
    },
    expectedText: /You are not currently connected to Metamask./,
  },
  {
    devName: "connected_user_with_expired_session",
    setUpMatch: ({store, props}) => {
      store.web3Status = connected
      store.user = {
        address: testUserAddress,
        info: {loaded: true, value: {goListed: false}},
      } as UserLoaded
      store.sessionData = {signatureBlockNum: 42, signatureBlockNumTimestamp: 47} as SessionData
    },
    setUpFallthrough: ({store}) => {
      store.sessionData = {signature: "foo", signatureBlockNum: 42, signatureBlockNumTimestamp: 47, version: 1}
    },
    expectedText: /Your session has expired. To use Goldfinch, you first need to reconnect to Metamask./,
  },
  {
    devName: "no_credit_line",
    setUpMatch: ({store, props}) => {
      store.sessionData = {signature: "foo", signatureBlockNum: 42, signatureBlockNumTimestamp: 47, version: 1}
      defaultCreditLine.loaded = true
      props.creditLine = defaultCreditLine as unknown as CreditLine
    },
    setUpFallthrough: ({store}) => {
      defaultCreditLine.loaded = false
    },
    expectedText: /You do not have any credit lines./,
  },
  {
    devName: "no_golist",
    setUpMatch: ({store, props}) => {
      props.requireGolist = true
    },
    setUpFallthrough: ({props}) => {
      props.requireGolist = false
    },
    expectedText:
      /This offering is only available to non-U.S. persons. To participate, you must first verify your address./,
  },
  {
    devName: "kyc_error",
    setUpMatch: ({store, props}) => {
      const erroredResult: AsyncResult<KYC> = {status: "errored", error: new Error("test")}
      props.requireKYC = {
        kyc: erroredResult,
        condition: (_) => true,
      }
    },
    setUpFallthrough: ({props}) => {
      props.requireKYC = undefined
    },
    expectedText: /Something went wrong./,
  },
  {
    devName: "kyc_loading",
    setUpMatch: ({store, props}) => {
      const loadingResult: AsyncResult<KYC> = {status: "loading"}
      props.requireKYC = {
        kyc: loadingResult,
        condition: (_) => true,
      }
    },
    setUpFallthrough: ({props}) => {},
    expectedText: /Loading/,
  },
  {
    devName: "kyc_succeeded",
    setUpMatch: ({store, props}) => {
      const kyc: AsyncResult<KYC> = {
        status: "succeeded",
        value: {
          status: "approved",
          countryCode: "CA",
        },
      }
      props.requireKYC = {
        kyc: kyc,
        // They don't meet the KYC check
        condition: (_) => false,
      }
    },
    setUpFallthrough: ({props}) => {
      const kyc: AsyncResult<KYC> = {
        status: "succeeded",
        value: {
          status: "approved",
          countryCode: "CA",
        },
      }
      props.requireKYC = {
        kyc: kyc,
        // They meet the KYC check
        condition: (_) => true,
      }
    },
    expectedText: /verify your address/,
  },
  {
    devName: "require_unlock",
    setUpMatch: ({store, props, context}) => {
      context.route = "/pools/senior"
      store.user = {
        address: testUserAddress,
        info: {
          loaded: true,
          value: {usdcIsUnlocked: {earn: {isUnlocked: false, unlockAddress: "0xtestpooladdress"}}},
        },
      } as UserLoaded
      props.requireUnlock = true
    },
    setUpFallthrough: ({props}) => {
      props.requireUnlock = false
    },
    expectedText: /Unlock USDC/,
  },
  {
    devName: "pool_paused",
    setUpMatch: ({store, props}) => {
      props.isPaused = true
    },
    setUpFallthrough: (_props) => {},
    expectedText: /The pool is currently paused/,
  },
  {
    devName: "pool_closed_to_user",
    setUpMatch: ({store, props}) => {
      props.isClosedToUser = true
    },
    setUpFallthrough: (_props) => {},
    expectedText: /The pool is currently closed to new participants\./,
  },
]

const scenariosMap = _.keyBy(scenarios, (s) => s.devName)

interface Context {
  route: string
}

describe("ConnectionNotice", () => {
  let store: GlobalState
  let context: Context
  let wrapper: React.FunctionComponent

  beforeEach(async () => {
    let network = {name: "mainnet", supported: true}
    let goldfinchProtocol = new GoldfinchProtocol(network)
    await goldfinchProtocol.initialize()
    store = {
      user: undefined,
      usdc: getERC20(Tickers.USDC, goldfinchProtocol),
      network,
    }
    context = {
      route: "/",
    }
    wrapper = ({children}) => (
      <AppContext.Provider value={store}>
        <MemoryRouter initialEntries={[context.route]}>{children}</MemoryRouter>
      </AppContext.Provider>
    )
  })

  describe.each(scenarios)("scenario %#", (scenario) => {
    describe("all other strategies fall through", () => {
      it("renders this component", async () => {
        const {devName} = scenario
        const strategyPosition = _.findIndex(strategies, (s) => devName === s.devName)
        const strategiesBefore = _.slice(strategies, 0, strategyPosition)
        const strategiesAfter = _.slice(strategies, strategyPosition + 1)
        let props = {}

        strategiesBefore.forEach((s) => {
          let scenario = scenariosMap[s.devName]
          scenario?.setUpFallthrough({store, props, context})
        })

        strategiesAfter.forEach((s) => {
          let scenario = scenariosMap[s.devName]
          scenario?.setUpFallthrough({store, props, context})
        })

        scenario.setUpMatch({store, props, context})

        render(<ConnectionNotice {...props} />, {wrapper})
        const renderedText = await screen.findByText(scenario.expectedText)
        expect(renderedText).toBeVisible()
      })
    })

    describe("strategies after this one match", () => {
      it("renders this component", async () => {
        const {devName} = scenario
        const strategyPosition = _.findIndex(strategies, (s) => devName === s.devName)
        const strategiesBefore = _.slice(strategies, 0, strategyPosition)
        const strategiesAfter = _.slice(strategies, strategyPosition + 1)
        let props = {}

        strategiesBefore.forEach((s) => {
          let scenario = scenariosMap[s.devName]
          scenario?.setUpFallthrough({store, props, context})
        })

        strategiesAfter.forEach((s) => {
          let scenario = scenariosMap[s.devName]
          scenario?.setUpMatch({store, props, context})
        })

        scenario.setUpMatch({store, props, context})

        render(<ConnectionNotice {...props} />, {wrapper})

        expect(await screen.findByText(scenario.expectedText)).toBeVisible()
      })
    })
  })
})
