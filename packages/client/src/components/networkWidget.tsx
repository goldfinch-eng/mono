import {assertUnreachable, isString} from "@goldfinch-eng/utils/src/type"
import _ from "lodash"
import React, {useContext, useEffect, useState} from "react"
import {AppContext} from "../App"
import {usdcFromAtomic} from "../ethereum/erc20"
import {
  ACCEPT_TX_TYPE,
  BORROW_TX_TYPE,
  CLAIM_TX_TYPE,
  CurrentTx,
  DRAWDOWN_TX_NAME,
  ERC20_APPROVAL_TX_TYPE,
  FIDU_APPROVAL_TX_TYPE,
  INTEREST_COLLECTED_TX_NAME,
  INTEREST_PAYMENT_TX_NAME,
  MINT_UID_TX_TYPE,
  PAYMENT_TX_TYPE,
  PRINCIPAL_COLLECTED_TX_NAME,
  RESERVE_FUNDS_COLLECTED_TX_NAME,
  STAKE_TX_TYPE,
  SUPPLY_AND_STAKE_TX_TYPE,
  SUPPLY_TX_TYPE,
  TxType,
  UNSTAKE_AND_WITHDRAW_FROM_SENIOR_POOL_TX_TYPE,
  UNSTAKE_TX_NAME,
  USDC_APPROVAL_TX_TYPE,
  WITHDRAW_FROM_TRANCHED_POOL_TX_TYPE,
  WITHDRAW_FROM_SENIOR_POOL_TX_TYPE,
} from "../types/transactions"
import {UserLoaded, UserLoadedInfo} from "../ethereum/user"
import {CONFIRMATION_THRESHOLD, getEtherscanSubdomain} from "../ethereum/utils"
import useCloseOnClickOrEsc from "../hooks/useCloseOnClickOrEsc"
import {isSessionDataInvalid, useSession, useSignIn} from "../hooks/useSignIn"
import {ArrayItemType, BlockInfo, croppedAddress, displayDollars, displayNumber} from "../utils"
import web3 from "../web3"
import {iconCheck, iconOutArrow} from "./icons"
import NetworkErrors from "./networkErrors"
import {NetworkConfig} from "../types/network"

interface NetworkWidgetProps {
  user: UserLoaded | undefined
  currentBlock: BlockInfo | undefined
  network: NetworkConfig | undefined
  currentErrors: any[]
  currentTxs: CurrentTx<TxType>[]
  connectionComplete: () => any
}

function NetworkWidget(props: NetworkWidgetProps) {
  const {web3Status, sessionData} = useContext(AppContext)
  const session = useSession()
  const [, signIn] = useSignIn()
  const [showSignIn, setShowSignIn] = useState<Boolean>(false)
  const {node, open: showNetworkWidgetInfo, setOpen: setShowNetworkWidgetInfo} = useCloseOnClickOrEsc<HTMLDivElement>()
  const currentTimestamp = props.currentBlock?.timestamp

  useEffect(() => {
    if (props.user && session.status !== "authenticated" && showSignIn) {
      signIn()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.user?.address, showSignIn])

  function enableMetamask() {
    if (session.status === "known" && !isSessionDataInvalid(sessionData, currentTimestamp)) {
      return Promise.resolve()
    }

    return (window as any).ethereum
      .request({method: "eth_requestAccounts"})
      .then(() => {
        props.connectionComplete()
        setShowSignIn(true)
      })
      .catch((error) => {
        console.error("Error connecting to metamask", error)
      })
  }

  function toggleOpenWidget() {
    if (showNetworkWidgetInfo === "") {
      setShowNetworkWidgetInfo("open")
    } else {
      setShowNetworkWidgetInfo("")
    }
  }

  let transactions: JSX.Element = <></>
  let enabledText = croppedAddress(props.user?.address)
  let userAddressForDisplay = croppedAddress(props.user?.address)
  let enabledClass = ""

  function transactionItem(tx: CurrentTx<TxType> | ArrayItemType<UserLoadedInfo["pastTxs"]>) {
    let transactionLabel: string
    if (tx.current) {
      switch (tx.name) {
        case MINT_UID_TX_TYPE:
        case USDC_APPROVAL_TX_TYPE:
        case FIDU_APPROVAL_TX_TYPE:
        case ERC20_APPROVAL_TX_TYPE:
        case CLAIM_TX_TYPE:
        case ACCEPT_TX_TYPE:
          transactionLabel = tx.name
          break
        case WITHDRAW_FROM_TRANCHED_POOL_TX_TYPE:
        case SUPPLY_AND_STAKE_TX_TYPE:
        case SUPPLY_TX_TYPE:
        case PAYMENT_TX_TYPE:
        case BORROW_TX_TYPE: {
          transactionLabel = `${displayDollars((tx.data as CurrentTx<typeof tx.name>["data"]).amount)} ${tx.name}`
          break
        }
        case WITHDRAW_FROM_SENIOR_POOL_TX_TYPE:
        case UNSTAKE_AND_WITHDRAW_FROM_SENIOR_POOL_TX_TYPE: {
          transactionLabel = `${displayDollars(
            (tx.data as CurrentTx<typeof tx.name>["data"]).recognizableUsdcAmount
          )} ${tx.name}`
          break
        }
        case STAKE_TX_TYPE: {
          transactionLabel = `${displayNumber((tx.data as CurrentTx<typeof tx.name>["data"]).fiduAmount)} FIDU ${
            tx.name
          }`
          break
        }
        default:
          assertUnreachable(tx)
      }
    } else {
      switch (tx.name) {
        case CLAIM_TX_TYPE:
        case ACCEPT_TX_TYPE:
        case MINT_UID_TX_TYPE:
        case USDC_APPROVAL_TX_TYPE:
        case FIDU_APPROVAL_TX_TYPE:
        case ERC20_APPROVAL_TX_TYPE:
          transactionLabel = tx.name
          break
        case SUPPLY_TX_TYPE:
        case PAYMENT_TX_TYPE:
        case SUPPLY_AND_STAKE_TX_TYPE:
        case WITHDRAW_FROM_TRANCHED_POOL_TX_TYPE:
        case WITHDRAW_FROM_SENIOR_POOL_TX_TYPE:
        case BORROW_TX_TYPE:
        case UNSTAKE_AND_WITHDRAW_FROM_SENIOR_POOL_TX_TYPE:
        case STAKE_TX_TYPE:
        case INTEREST_COLLECTED_TX_NAME:
        case PRINCIPAL_COLLECTED_TX_NAME:
        case RESERVE_FUNDS_COLLECTED_TX_NAME:
        case INTEREST_PAYMENT_TX_NAME:
        case DRAWDOWN_TX_NAME:
        case UNSTAKE_TX_NAME:
          switch (tx.amount.units) {
            case "usdc":
              transactionLabel = `${displayDollars(tx.amount.display)} ${tx.name}`
              break
            case "fidu":
              transactionLabel = `${displayNumber(tx.amount.display)} FIDU ${tx.name}`
              break
            case "gfi":
              transactionLabel = `${displayNumber(tx.amount.display)} GFI ${tx.name}`
              break
            default:
              assertUnreachable(tx.amount.units)
          }
          break
        default:
          assertUnreachable(tx)
      }
    }

    const etherscanSubdomain = getEtherscanSubdomain(props.network)

    let confirmationMessage: JSX.Element = <></>

    return (
      <div key={tx.id} className={`transaction-item ${tx.status}`}>
        <div className="status-icon">
          <div className="indicator"></div>
          <div className="spinner">
            <div className="double-bounce1"></div>
            <div className="double-bounce2"></div>
          </div>
        </div>
        {transactionLabel}&nbsp;
        {web3.utils.isHexStrict(tx.id) && (
          <a
            className="inline-button"
            href={isString(etherscanSubdomain) ? `https://${etherscanSubdomain}etherscan.io/tx/${tx.id}` : ""}
            target="_blank"
            rel="noopener noreferrer"
          >
            {iconOutArrow}
          </a>
        )}
        {confirmationMessage}
      </div>
    )
  }

  // Only show the error state when the most recent transaction is errored
  if (props.currentErrors.length > 0 && props.currentTxs[0]?.status === "error") {
    enabledClass = "error"
    enabledText = "Error"
  } else if (_.some(props.currentTxs, {status: "pending"})) {
    const pendingTXCount: number = _.countBy(props.currentTxs, {status: "pending"}).true || 0
    const confirmingCount: number =
      _.countBy(props.currentTxs, (item) => {
        return item.status === "pending" && item.confirmations > 0
      }).true || 0
    enabledClass = "pending"
    if (confirmingCount > 0) {
      const pendingTX = props.currentTxs[0]
      enabledText = `Confirming (${pendingTX!.confirmations} of ${CONFIRMATION_THRESHOLD})`
    } else if (pendingTXCount > 0) {
      enabledText = pendingTXCount === 1 ? "Processing" : pendingTXCount + " Processing"
    }
  } else if (props.currentTxs.length > 0 && _.every(props.currentTxs, {status: "successful"})) {
    enabledClass = "success"
  }

  let allTxs = _.compact([...props.currentTxs, ..._.slice(props.user ? props.user.info.value.pastTxs : [], 0, 5)])
  allTxs = _.uniqBy(allTxs, "id")
  if (allTxs.length > 0) {
    transactions = (
      <div className="network-widget-section">
        <div className="network-widget-header">
          Recent Transactions
          <a href="/transactions">view all</a>
        </div>
        {allTxs.map(transactionItem)}
      </div>
    )
  }

  const connectMetamaskNetworkWidget = (
    <div ref={node} className={`network-widget ${showNetworkWidgetInfo}`}>
      <button className="network-widget-button bold" onClick={toggleOpenWidget}>
        Connect Metamask
      </button>
      <div className="network-widget-info">
        <div className="network-widget-section">
          <div className="agree-to-terms">
            <p>
              By connecting, I accept Goldfinch's{" "}
              <a href="/terms" target="_blank">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" target="_blank">
                Privacy Policy
              </a>
              .
            </p>
          </div>
          <button className="button bold" onClick={enableMetamask}>
            Connect Metamask
          </button>
        </div>
      </div>
    </div>
  )

  const enabledNetworkWidget = (
    <div ref={node} className={`network-widget ${showNetworkWidgetInfo}`}>
      <button className={`network-widget-button ${enabledClass}`} onClick={toggleOpenWidget}>
        <div className="status-icon">
          <div className="indicator"></div>
          <div className="spinner">
            <div className="double-bounce1"></div>
            <div className="double-bounce2"></div>
          </div>
        </div>
        {enabledText}
        <div className="success-indicator">{iconCheck}Success</div>
      </button>
      <div className="network-widget-info">
        <div className="network-widget-section address">{userAddressForDisplay}</div>
        <NetworkErrors currentErrors={props.currentErrors} />
        <div className="network-widget-section">
          USDC balance{" "}
          <span className="value">
            {displayNumber(props.user ? usdcFromAtomic(props.user.info.value.usdcBalance) : undefined, 2)}
          </span>
        </div>
        {transactions}
      </div>
    </div>
  )

  if (web3Status?.type === "no_web3") {
    return (
      <div ref={node} className="network-widget">
        <a href="https://metamask.io" className="network-widget-button bold">
          Go to metamask.io
        </a>
      </div>
    )
  } else if (!web3Status || (web3Status.type === "connected" && !props.user)) {
    return (
      <div ref={node} className="network-widget">
        <div className="network-widget-button">
          <div className="status-icon">
            <div className="indicator"></div>
          </div>
          Loading...
        </div>
      </div>
    )
  } else if (web3 && props.network && props.network.name && !props.network.supported) {
    return (
      <div ref={node} className="network-widget">
        <div className="network-widget-button disabled">Wrong Network</div>
      </div>
    )
  } else if (
    web3Status.type === "has_web3" ||
    (web3Status.type === "connected" && session.status !== "authenticated") ||
    isSessionDataInvalid(sessionData, currentTimestamp)
  ) {
    return connectMetamaskNetworkWidget
  } else {
    return enabledNetworkWidget
  }
}

export default NetworkWidget
