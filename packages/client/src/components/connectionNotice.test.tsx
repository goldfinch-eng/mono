import "@testing-library/jest-dom"
import {Matcher, render, screen} from "@testing-library/react"
import _ from "lodash"
import React from "react"
import {MemoryRouter} from "react-router-dom"
import {AppContext, GlobalState} from "../App"
import {BorrowerInterface} from "../ethereum/borrower"
import {getERC20, Ticker} from "../ethereum/erc20"
import {GoldfinchProtocol} from "../ethereum/GoldfinchProtocol"
import {UserLoaded} from "../ethereum/user"
import {AsyncResult} from "../hooks/useAsync"
import {KYC} from "../hooks/useGoldfinchClient"
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

const scenarios: Scenario[] = [
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
    expectedText: /You are on an unsupported network, please switch to Ethereum mainnet/,
  },
  {
    devName: "no_credit_line",
    setUpMatch: ({store, props}) => {
      props.showCreditLineStatus = true
      store.user = {
        address: testUserAddress,
        borrower: {
          creditLinesAddresses: [],
        } as unknown as BorrowerInterface,
        info: {loaded: true, value: {goListed: false}},
      } as UserLoaded
      store.sessionData = {signature: "foo", signatureBlockNum: 42, signatureBlockNumTimestamp: 47, version: 1}
    },
    setUpFallthrough: ({store}) => {},
    expectedText: /You do not have any credit lines./,
  },
  {
    devName: "no_golist",
    setUpMatch: ({store, props}) => {
      store.user = {
        address: testUserAddress,
        info: {loaded: true, value: {goListed: false}},
      } as UserLoaded
      props.requireGolist = true
    },
    setUpFallthrough: ({props}) => {
      props.requireGolist = false
    },
    expectedText: /This pool is disabled for unverified addresses. You must first verify your address/,
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
      usdc: getERC20(Ticker.USDC, goldfinchProtocol),
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
