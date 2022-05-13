import {assertUnreachable, isString} from "@goldfinch-eng/utils/src/type"
import _ from "lodash"
import React, {useContext, useState} from "react"
import {AppContext} from "../App"
import {usdcFromAtomic} from "../ethereum/erc20"
import {UserLoaded, UserLoadedInfo} from "../ethereum/user"
import {CONFIRMATION_THRESHOLD, getEtherscanSubdomain} from "../ethereum/utils"
import useCloseOnClickOrEsc from "../hooks/useCloseOnClickOrEsc"
import {useSignIn} from "../hooks/useSignIn"
import {NetworkConfig} from "../types/network"
import {
  ACCEPT_TX_TYPE,
  BORROW_TX_TYPE,
  CLAIM_TX_TYPE,
  CurrentTx,
  DEPOSIT_TO_CURVE_TX_TYPE,
  DEPOSIT_TO_CURVE_AND_STAKE_TX_TYPE,
  DRAWDOWN_TX_NAME,
  ERC20_APPROVAL_TX_TYPE,
  FIDU_APPROVAL_TX_TYPE,
  INTEREST_AND_PRINCIPAL_PAYMENT_TX_NAME,
  FIDU_USDC_CURVE_APPROVAL_TX_TYPE,
  INTEREST_COLLECTED_TX_NAME,
  INTEREST_PAYMENT_TX_NAME,
  MINT_UID_TX_TYPE,
  PAYMENT_TX_TYPE,
  PRINCIPAL_COLLECTED_TX_NAME,
  PRINCIPAL_PAYMENT_TX_NAME,
  RESERVE_FUNDS_COLLECTED_TX_NAME,
  STAKE_TX_TYPE,
  SUPPLY_AND_STAKE_TX_TYPE,
  SUPPLY_TX_TYPE,
  TxType,
  UNSTAKE_AND_WITHDRAW_FROM_SENIOR_POOL_TX_TYPE,
  UNSTAKE_TX_TYPE,
  UNSTAKE_TX_NAME,
  USDC_APPROVAL_TX_TYPE,
  WITHDRAW_FROM_SENIOR_POOL_TX_TYPE,
  WITHDRAW_FROM_TRANCHED_POOL_TX_TYPE,
  ZAP_STAKE_TO_CURVE_TX_TYPE,
  ERC721_APPROVAL_TX_TYPE,
} from "../types/transactions"
import {
  ArrayItemType,
  BlockInfo,
  croppedAddress,
  displayDollars,
  displayNumber,
  isProductionAndPrivateNetwork,
  getInjectedProvider,
} from "../utils"
import getWeb3, {
  onWalletConnect,
  closeWalletConnect,
  isMetaMaskInpageProvider,
  requestUserAddGfiTokenToWallet,
} from "../web3"
import {iconCheck, iconOutArrow, iconSolidError, iconSolidCheck, iconDisconnect} from "./icons"
import NetworkErrors from "./networkErrors"
import metaMaskLogo from "../images/metamask-logo.svg"
import walletConnectLogo from "../images/walletconnect-logo.svg"
import {isWalletConnectProvider} from "../walletConnect"
import BigNumber from "bignumber.js"

interface NetworkWidgetProps {
  user: UserLoaded | undefined
  currentBlock: BlockInfo | undefined
  network: NetworkConfig | undefined
  currentErrors: any[]
  currentTxs: CurrentTx<TxType>[]
  connectionComplete: () => any
}

function NetworkWidget(props: NetworkWidgetProps) {
  const {userWalletWeb3Status, gfi} = useContext(AppContext)
  const [session, signIn] = useSignIn()
  const {node, open: showNetworkWidgetInfo, setOpen: setShowNetworkWidgetInfo} = useCloseOnClickOrEsc<HTMLDivElement>()
  const [isEnablePending, setIsEnablePending] = useState<{metaMask: boolean; walletConnect: boolean}>({
    walletConnect: false,
    metaMask: false,
  })
  const [isSignInPending, setIsSignInPending] = useState<boolean>(false)
  const [noWeb3Widget, setNoWeb3Widget] = useState<boolean>(false)
  const [showInstallWallet, setShowInstallWallet] = useState<boolean>(false)
  const [showWallets, setShowWallets] = useState<boolean>(false)
  const web3 = getWeb3()

  async function handleSignIn(): Promise<void> {
    setShowWallets(false)
    setIsSignInPending(true)
    await signIn().catch((error) => {
      console.error("Error connecting to wallet", error)
    })
    setIsSignInPending(false)
  }

  async function enableMetamask(): Promise<void> {
    const injectedProvider = getInjectedProvider()
    if (injectedProvider) {
      return injectedProvider
        .request({method: "eth_requestAccounts"})
        .then(async () => {
          await props.connectionComplete()
          await handleSignIn()
        })
        .catch((error) => {
          console.error("Error connecting to metamask", error)
        })
    }
  }

  function isMetaMaskInstalled(): boolean {
    return (
      (userWalletWeb3Status?.type === "has_web3" || userWalletWeb3Status?.type === "connected") &&
      window.hasOwnProperty("ethereum") &&
      isMetaMaskInpageProvider(getInjectedProvider())
    )
  }

  async function handleMetamask(): Promise<void> {
    if (!isMetaMaskInstalled()) {
      return setNoWeb3Widget(true)
    }
    setIsEnablePending({metaMask: true, walletConnect: false})
    await enableMetamask()
    setIsEnablePending({metaMask: false, walletConnect: false})
  }

  async function handleWalletConnect(): Promise<void> {
    await onWalletConnect()
      .then(async () => {
        await props.connectionComplete()
        await handleSignIn()
      })
      .catch((error) => {
        console.error("Error connecting to wallet", error)
      })
  }

  async function handleAddGFIToWallet() {
    if (gfi?.address) {
      await requestUserAddGfiTokenToWallet(gfi?.address)
    }
  }

  function toggleOpenWidget() {
    if (showNetworkWidgetInfo === "") {
      setShowNetworkWidgetInfo("open")
    } else {
      setShowNetworkWidgetInfo("")
    }
  }

  function walletConnectButton(): JSX.Element {
    return (
      <button
        className={`button wallet ${(isEnablePending.metaMask || isEnablePending.walletConnect) && "active"}`}
        onClick={handleWalletConnect}
        disabled={isEnablePending.metaMask || isEnablePending.walletConnect}
      >
        <img className="wallet-logo" src={walletConnectLogo} alt="WalletConnect Logo" />
        {isEnablePending.walletConnect ? "Working..." : "WalletConnect"}
      </button>
    )
  }

  let transactions: JSX.Element = <></>
  let enabledText = croppedAddress(userWalletWeb3Status?.address)
  let userAddressForDisplay = croppedAddress(userWalletWeb3Status?.address)
  let enabledClass = ""

  function transactionItem(tx: CurrentTx<TxType> | ArrayItemType<UserLoadedInfo["pastTxs"]>) {
    let transactionLabel: string
    if (tx.current) {
      switch (tx.name) {
        case MINT_UID_TX_TYPE:
        case USDC_APPROVAL_TX_TYPE:
        case FIDU_APPROVAL_TX_TYPE:
        case FIDU_USDC_CURVE_APPROVAL_TX_TYPE:
        case ERC20_APPROVAL_TX_TYPE:
        case ERC721_APPROVAL_TX_TYPE:
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
        case UNSTAKE_TX_TYPE: {
          transactionLabel = `${displayNumber((tx.data as CurrentTx<typeof tx.name>["data"]).totalAmount)} ${
            (tx.data as CurrentTx<typeof tx.name>["data"]).ticker
          } ${tx.name}`
          break
        }
        case STAKE_TX_TYPE: {
          transactionLabel = `${displayNumber((tx.data as CurrentTx<typeof tx.name>["data"]).amount)} ${
            (tx.data as CurrentTx<typeof tx.name>["data"]).ticker
          } ${tx.name}`
          break
        }
        case DEPOSIT_TO_CURVE_TX_TYPE:
        case DEPOSIT_TO_CURVE_AND_STAKE_TX_TYPE:
          let fiduAmount = (tx.data as CurrentTx<typeof tx.name>["data"]).fiduAmount
          let usdcAmount = (tx.data as CurrentTx<typeof tx.name>["data"]).usdcAmount
          if (new BigNumber(fiduAmount).isZero() && !new BigNumber(usdcAmount).isZero()) {
            // USDC-only deposit
            transactionLabel = `${displayNumber(usdcAmount)} USDC ${tx.name}`
          } else if (!new BigNumber(fiduAmount).isZero() && new BigNumber(usdcAmount).isZero()) {
            // FIDU-only deposit
            transactionLabel = `${displayNumber(fiduAmount)} FIDU ${tx.name}`
          } else {
            // FIDU and USDC deposit
            transactionLabel = `${displayNumber(fiduAmount)} FIDU, ${displayNumber(usdcAmount)} USDC ${tx.name}`
          }
          break
        case ZAP_STAKE_TO_CURVE_TX_TYPE: {
          fiduAmount = (tx.data as CurrentTx<typeof tx.name>["data"]).fiduAmount
          usdcAmount = (tx.data as CurrentTx<typeof tx.name>["data"]).usdcAmount
          transactionLabel = `${displayNumber(fiduAmount)} FIDU, ${displayNumber(usdcAmount)} USDC ${tx.name}`
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
        case FIDU_USDC_CURVE_APPROVAL_TX_TYPE:
        case ERC20_APPROVAL_TX_TYPE:
        case ERC721_APPROVAL_TX_TYPE:
          transactionLabel = tx.name
          break
        case SUPPLY_TX_TYPE:
        case PAYMENT_TX_TYPE:
        case SUPPLY_AND_STAKE_TX_TYPE:
        case DEPOSIT_TO_CURVE_TX_TYPE:
        case DEPOSIT_TO_CURVE_AND_STAKE_TX_TYPE:
        case ZAP_STAKE_TO_CURVE_TX_TYPE:
        case WITHDRAW_FROM_TRANCHED_POOL_TX_TYPE:
        case WITHDRAW_FROM_SENIOR_POOL_TX_TYPE:
        case BORROW_TX_TYPE:
        case UNSTAKE_AND_WITHDRAW_FROM_SENIOR_POOL_TX_TYPE:
        case UNSTAKE_TX_TYPE:
        case STAKE_TX_TYPE:
        case INTEREST_COLLECTED_TX_NAME:
        case PRINCIPAL_COLLECTED_TX_NAME:
        case RESERVE_FUNDS_COLLECTED_TX_NAME:
        case INTEREST_PAYMENT_TX_NAME:
        case PRINCIPAL_PAYMENT_TX_NAME:
        case INTEREST_AND_PRINCIPAL_PAYMENT_TX_NAME:
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
            case "fidu-usdc-f":
              transactionLabel = `${displayNumber(tx.amount.display)} FIDU-USDC-F ${tx.name}`
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
        <div>
          <div className="status-icon">
            {tx.status === "error" && <div className="tx-status-indicator error-icon">{iconSolidError}</div>}
            {tx.status === "successful" && <div className="tx-status-indicator success-icon">{iconSolidCheck}</div>}
            <div className="spinner">
              <div className="double-bounce1"></div>
              <div className="double-bounce2"></div>
            </div>
          </div>
          <div>
            <span className={`${tx.status === "error" && "error-text"}`}>{transactionLabel}&nbsp;</span>
          </div>
        </div>
        <div>
          {web3.readOnly.utils.isHexStrict(tx.id) && (
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

  let allTxs = [...props.currentTxs, ..._.slice(props.user ? props.user.info.value.pastTxs : [], 0, 5)]
  // Makes newer transactions always appear on top
  allTxs = allTxs.sort((a, b) => {
    if (a.current && b.current) {
      if (a.blockTime < b.blockTime) {
        return 1
      } else {
        return -1
      }
    }
    if (a.blockNumber && b.blockNumber) {
      if (a.blockNumber < b.blockNumber) {
        return 1
      } else if (a.blockNumber === b.blockNumber) {
        return 0
      } else {
        return -1
      }
    }
    return 0
  })
  allTxs = _.compact(allTxs)
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

  if (!userWalletWeb3Status) {
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
  } else if (showInstallWallet) {
    return (
      <div ref={node} className={`network-widget ${showNetworkWidgetInfo}`}>
        <button className="network-widget-button bold" onClick={toggleOpenWidget}>
          Connect Wallet
        </button>
        <div className="network-widget-info">
          <div className="network-widget-section install-wallet-info">
            <p>
              A wallet makes it possible for you to hold tokens and to participate in Goldfinch activities like
              investing and governance.
            </p>
            <p>Goldfinch is compatible with any Ethereum wallet, but here are some we recommend.</p>
            <a href="https://metamask.io/" rel="noreferrer" target="_blank" className="button wallet">
              <img className="wallet-logo" src={metaMaskLogo} alt="MetaMask Logo" />
              <span>Install MetaMask</span>
              <span className="out-icon">{iconOutArrow}</span>
            </a>
            <button className="no-wallet" onClick={() => setShowInstallWallet(false)}>
              Back to wallets
            </button>
          </div>
        </div>
      </div>
    )
  } else if (
    (userWalletWeb3Status?.type === "has_web3" && props.network && props.network.name && !props.network.supported) ||
    isProductionAndPrivateNetwork(props.network)
  ) {
    return (
      <div ref={node} className="network-widget">
        <div className="network-widget-button disabled">Wrong Network</div>
      </div>
    )
  } else if (noWeb3Widget) {
    return (
      <div ref={node} className={`network-widget ${showNetworkWidgetInfo}`}>
        <button className="network-widget-button bold" onClick={toggleOpenWidget}>
          Connect Wallet
        </button>
        <div className="network-widget-info">
          <div className="network-widget-section no-metamask-info">
            <p>
              Looks like you don’t have Metamask installed. Go to Metamask’s website and download and install the
              browser extension.
            </p>
            <a href="https://metamask.io/" rel="noreferrer" target="_blank" className="button wallet">
              <img className="wallet-logo" src={metaMaskLogo} alt="MetaMask Logo" />
              <span>Install MetaMask</span>
              <span className="out-icon">{iconOutArrow}</span>
            </a>
            {walletConnectButton()}
            <button className="no-wallet" onClick={() => setNoWeb3Widget(false)}>
              Back to wallets
            </button>
          </div>
        </div>
      </div>
    )
  } else if (userWalletWeb3Status?.type === "connected" && session.status !== "authenticated" && !showWallets) {
    return (
      <div ref={node} className={`network-widget ${showNetworkWidgetInfo}`}>
        <button className="network-widget-button bold" onClick={toggleOpenWidget}>
          Connect Wallet
        </button>
        <div className="network-widget-info">
          <div className="network-widget-section wallet-address">
            <span>Wallet address</span>
            <div className="address">{userAddressForDisplay}</div>
          </div>
          <div className="network-widget-section">
            <button
              className={`button bold ${isSignInPending && "wallet active"}`}
              disabled={isSignInPending}
              onClick={handleSignIn}
            >
              {isSignInPending ? "Waiting..." : "Connect"}
            </button>
            {isSignInPending ? (
              <span className="check-wallet">Check your wallet to finish signing</span>
            ) : (
              <button className="other-wallets" onClick={() => setShowWallets(true)}>
                Other wallets
              </button>
            )}
          </div>
        </div>
      </div>
    )
  } else if (userWalletWeb3Status?.type === "connected" && session.status === "authenticated") {
    const usdcBalance = props.user ? displayNumber(usdcFromAtomic(props.user.info.value.usdcBalance), 2) : "Loading..."
    return (
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
          <div className="network-widget-section wallet-address">
            <span>Wallet address</span>
            <div className="address">{userAddressForDisplay}</div>
          </div>
          <NetworkErrors currentErrors={props.currentErrors} />
          <div className="network-widget-section">
            USDC balance <span className="value">{usdcBalance}</span>
          </div>
          {transactions}
          {isWalletConnectProvider(web3.readOnly.currentProvider) ? (
            <button className="disconnect" onClick={closeWalletConnect}>
              {iconDisconnect} Disconnect wallet
            </button>
          ) : (
            <button className="add-gfi-to-wallet" onClick={handleAddGFIToWallet}>
              Add GFI token to wallet {iconOutArrow}
            </button>
          )}
        </div>
      </div>
    )
  } else {
    return (
      <div ref={node} className={`network-widget ${showNetworkWidgetInfo}`}>
        <button className="network-widget-button bold" onClick={toggleOpenWidget}>
          Connect Wallet
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
            <button
              className={`button wallet ${(isEnablePending.metaMask || isEnablePending.walletConnect) && "active"}`}
              onClick={handleMetamask}
              disabled={isEnablePending.metaMask || isEnablePending.walletConnect}
            >
              <img className="wallet-logo" src={metaMaskLogo} alt="MetaMask Logo" />
              {isEnablePending.metaMask ? "Working..." : "MetaMask"}
            </button>
            {walletConnectButton()}
            <button className="no-wallet" onClick={() => setShowInstallWallet(true)}>
              I don't have a wallet
            </button>
          </div>
        </div>
      </div>
    )
  }
}

export default NetworkWidget
