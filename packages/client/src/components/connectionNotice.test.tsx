import _ from "lodash"
import React from "react"
import ConnectionNotice, {ConnectionNoticeProps, strategies} from "./connectionNotice"
import {Matcher, render, screen, waitFor} from "@testing-library/react"
import {MemoryRouter} from "react-router-dom"
import {AppContext, GlobalState} from "../App"
import {defaultUser, UNLOCK_THRESHOLD} from "../ethereum/user"
import "@testing-library/jest-dom"
import {CreditLine, defaultCreditLine} from "../ethereum/creditLine"
import {AsyncResult} from "../hooks/useAsync"
import {KYC} from "../hooks/useGoldfinchClient"
import {getERC20, Tickers} from "../ethereum/erc20"
import {GoldfinchProtocol} from "../ethereum/GoldfinchProtocol"

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

const scenarios: Scenario[] = [
  {
    devName: "install_metamask",
    setUpMatch: (_props) => {},
    setUpFallthrough: (_props) => {
      ;(window as any).ethereum = "fake_ethereum_provider"
    },
    expectedText: /you'll first need to download and install the Metamask plug-in/,
  },
  {
    devName: "pool_paused",
    setUpMatch: ({props}) => {
      props.isPaused = true
    },
    setUpFallthrough: (_props) => {},
    expectedText: /The pool is currently paused/,
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
      store.user.web3Connected = true
      store.user.address = ""
    },
    setUpFallthrough: ({store}) => {
      store.user.web3Connected = true
      store.user.address = "0xtest"
    },
    expectedText: /You are not currently connected to Metamask./,
  },
  {
    devName: "connected_user_with_expired_session",
    setUpMatch: ({store, props}) => {
      store.user.web3Connected = true
      store.user.address = "0xtest"
      store.sessionData = undefined
    },
    setUpFallthrough: ({store}) => {
      // @ts-expect-error ts-migrate(2741) FIXME: Property 'version' is missing in type '{ signature... Remove this comment to see the full error message
      store.sessionData = {signature: "foo", signatureBlockNum: 42, signatureBlockNumTimestamp: 47}
    },
    expectedText: /Your session has expired. To use Goldfinch, you first need to reconnect to Metamask./,
  },
  {
    devName: "no_credit_line",
    setUpMatch: ({store, props}) => {
      defaultCreditLine.loaded = true
      store.user.loaded = true
      props.creditLine = defaultCreditLine as CreditLine
    },
    setUpFallthrough: ({store}) => {
      defaultCreditLine.loaded = false
      // @ts-expect-error ts-migrate(2741) FIXME: Property 'version' is missing in type '{ signature... Remove this comment to see the full error message
      store.sessionData = {signature: "foo", signatureBlockNum: 42, signatureBlockNumTimestamp: 47}
    },
    expectedText: /You do not have any credit lines./,
  },
  {
    devName: "no_golist",
    setUpMatch: ({store, props}) => {
      store.user.goListed = false
      store.user.loaded = true
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
    setUpMatch: ({props}) => {
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
    setUpMatch: ({props}) => {
      const loadingResult: AsyncResult<KYC> = {status: "loading"}
      props.requireKYC = {
        kyc: loadingResult,
        condition: (_) => true,
      }
    },
    setUpFallthrough: ({props}) => {
      props.requireKYC = undefined
    },
    expectedText: /Loading/,
  },
  {
    devName: "kyc_succeeded",
    setUpMatch: ({store, props}) => {
      store.user.loaded = true
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
      store.user.loaded = true
      store.user.poolAllowance = UNLOCK_THRESHOLD
      props.requireUnlock = true
    },
    setUpFallthrough: ({props}) => {
      props.requireUnlock = false
    },
    expectedText: /Unlock USDC/,
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
      user: defaultUser(),
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
