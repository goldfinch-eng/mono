import {assertUnreachable} from "@goldfinch-eng/utils/src/type"
import BigNumber from "bignumber.js"
import {memoize} from "lodash"
import {Contract} from "web3-eth-contract"
import {AbiItem} from "web3-utils/types"
import {Web3IO} from "../types/web3"
import {BlockInfo} from "../utils"
import getWeb3 from "../web3"
import * as ERC20Contract from "./ERC20.json"
import {FIDU_DECIMALS} from "./fidu"
import {GoldfinchProtocol} from "./GoldfinchProtocol"
import {
  BUSD_ADDRESSES,
  CURVE_LP_TOKEN_ADDRESSES,
  decimals,
  isMainnetForking,
  USDC_ADDRESSES,
  USDT_ADDRESSES,
} from "./utils"
import {
  ERC20_APPROVAL_TX_TYPE,
  FIDU_APPROVAL_TX_TYPE,
  FIDU_USDC_CURVE_APPROVAL_TX_TYPE,
  TxType,
  USDC_APPROVAL_TX_TYPE,
} from "../types/transactions"

enum Ticker {
  USDC = "USDC",
  USDT = "USDT",
  BUSD = "BUSD",
  FIDU = "FIDU",
  GFI = "GFI",
  CURVE_FIDU_USDC = "FIDU-USDC-F",
}

export type ERC20Metadata = {
  name: string
  ticker: Ticker
  decimals: number
  approvalTxType: TxType
  icon?: any
}

abstract class ERC20 {
  name: string
  ticker: Ticker
  networksToAddress: any
  localContractName?: string
  permitVersion?: string
  decimals: number
  approvalTxType: TxType
  contract!: Web3IO<Contract>
  goldfinchProtocol: GoldfinchProtocol

  constructor(goldfinchProtocol, metadata: ERC20Metadata) {
    this.goldfinchProtocol = goldfinchProtocol

    this.name = metadata.name
    this.ticker = metadata.ticker
    this.decimals = metadata.decimals
    this.approvalTxType = metadata.approvalTxType

    this.networksToAddress = {}
  }

  initialize() {
    this.contract = this.initializeContract()
  }

  initializeContract(): Web3IO<Contract> {
    const config = this.goldfinchProtocol.deployments
    const localContract = this.localContractName && config.contracts[this.localContractName]
    const web3 = getWeb3()
    let address
    if (localContract) {
      address = localContract.address
    } else {
      if (process.env.REACT_APP_HARDHAT_FORK) {
        address = this.networksToAddress[process.env.REACT_APP_HARDHAT_FORK]
      } else {
        // Assume we're on testnet or mainnet
        address = this.networksToAddress[this.goldfinchProtocol.networkId]
      }
    }
    const readOnlyErc20 = new web3.readOnly.eth.Contract(ERC20Contract.abi as AbiItem[], address)
    const userWalletErc20 = new web3.userWallet.eth.Contract(ERC20Contract.abi as AbiItem[], address)
    return {readOnly: readOnlyErc20, userWallet: userWalletErc20}
  }

  get address() {
    return this.contract.readOnly.options.address
  }

  async getAllowance(
    {owner, spender}: {owner: string; spender: string},
    currentBlock: BlockInfo | undefined
  ): Promise<BigNumber> {
    return new BigNumber(
      await this.contract.readOnly.methods
        .allowance(owner, spender)
        .call(undefined, currentBlock ? currentBlock.number : "latest")
    )
  }

  async getBalance(address: string, currentBlock: BlockInfo | undefined): Promise<BigNumber> {
    return new BigNumber(
      await this.contract.readOnly.methods
        .balanceOf(address)
        .call(undefined, currentBlock ? currentBlock.number : "latest")
    )
  }

  atomicAmount(decimalAmount) {
    let ten = new BigNumber(10)
    return new BigNumber(String(decimalAmount)).multipliedBy(ten.pow(this.decimals)).toString(10)
  }

  decimalAmount(atomicAmount) {
    let ten = new BigNumber(10)
    return new BigNumber(String(atomicAmount)).div(ten.pow(this.decimals)).toString(10)
  }
}

class USDC extends ERC20 {
  static metadata: ERC20Metadata = {
    name: "USD Coin",
    ticker: Ticker.USDC,
    decimals: 6,
    approvalTxType: USDC_APPROVAL_TX_TYPE as TxType,
    icon: buildTokenIconURL("usdc.png"),
  }

  constructor(goldfinchProtocol: GoldfinchProtocol) {
    super(goldfinchProtocol, USDC.metadata)
    this.networksToAddress = USDC_ADDRESSES
    this.localContractName = "TestERC20"

    this.permitVersion = this.goldfinchProtocol.networkId === "localhost" && !isMainnetForking() ? "1" : "2"
  }
}

class USDT extends ERC20 {
  static metadata = {
    name: "Tether USD",
    ticker: Ticker.USDT,
    decimals: 6,
    approvalTxType: ERC20_APPROVAL_TX_TYPE as TxType,
  }

  constructor(goldfinchProtocol: GoldfinchProtocol) {
    super(goldfinchProtocol, USDT.metadata)
    this.networksToAddress = USDT_ADDRESSES
  }
}

class BUSD extends ERC20 {
  static metadata = {
    name: "Binance USD",
    ticker: Ticker.BUSD,
    decimals: 18,
    approvalTxType: ERC20_APPROVAL_TX_TYPE as TxType,
  }

  constructor(goldfinchProtocol: GoldfinchProtocol) {
    super(goldfinchProtocol, BUSD.metadata)
    this.networksToAddress = BUSD_ADDRESSES
  }
}

class FIDU extends ERC20 {
  static metadata = {
    name: "FIDU",
    ticker: Ticker.FIDU,
    decimals: 18,
    approvalTxType: FIDU_APPROVAL_TX_TYPE as TxType,
    icon: buildTokenIconURL("fidu.svg"),
  }

  constructor(goldfinchProtocol: GoldfinchProtocol) {
    super(goldfinchProtocol, FIDU.metadata)
    this.localContractName = "Fidu"
  }
}

class GFI extends ERC20 {
  static metadata = {
    name: "GFI",
    ticker: Ticker.GFI,
    decimals: 18,
    approvalTxType: ERC20_APPROVAL_TX_TYPE as TxType,
    icon: buildTokenIconURL("gfi.svg"),
  }

  constructor(goldfinchProtocol: GoldfinchProtocol) {
    super(goldfinchProtocol, FIDU.metadata)
    this.localContractName = "Fidu"
  }
}

class CURVE_FIDU_USDC extends ERC20 {
  static metadata = {
    name: "Curve.fi Factory Crypto Pool: Goldfinch FIDU/USDC",
    ticker: Ticker.CURVE_FIDU_USDC,
    decimals: 18,
    approvalTxType: FIDU_USDC_CURVE_APPROVAL_TX_TYPE as TxType,
    icon: buildTokenIconURL("curve.png"),
  }

  constructor(goldfinchProtocol: GoldfinchProtocol) {
    super(goldfinchProtocol, CURVE_FIDU_USDC.metadata)
    this.networksToAddress = CURVE_LP_TOKEN_ADDRESSES
    this.localContractName = "TestFiduUSDCCurveLP"
  }
}

function buildTokenIconURL(path: string): string {
  return `${process.env.PUBLIC_URL}/icons/${path}`
}

function getERC20Metadata(ticker: Ticker): ERC20Metadata {
  switch (ticker) {
    case Ticker.USDC:
      return USDC.metadata
    case Ticker.USDT:
      return USDT.metadata
    case Ticker.BUSD:
      return BUSD.metadata
    case Ticker.FIDU:
      return FIDU.metadata
    case Ticker.GFI:
      return GFI.metadata
    case Ticker.CURVE_FIDU_USDC:
      return CURVE_FIDU_USDC.metadata
    default:
      assertUnreachable(ticker)
  }
}

let getERC20 = memoize(
  (ticker: Ticker, goldfinchProtocol: GoldfinchProtocol) => {
    let erc20
    switch (ticker) {
      case Ticker.USDC:
        erc20 = new USDC(goldfinchProtocol)
        break
      case Ticker.USDT:
        erc20 = new USDT(goldfinchProtocol)
        break
      case Ticker.BUSD:
        erc20 = new BUSD(goldfinchProtocol)
        break
      case Ticker.FIDU:
        erc20 = new FIDU(goldfinchProtocol)
        break
      case Ticker.GFI:
        erc20 = new GFI(goldfinchProtocol)
        break
      case Ticker.CURVE_FIDU_USDC:
        erc20 = new CURVE_FIDU_USDC(goldfinchProtocol)
        break
      default:
        assertUnreachable(ticker)
    }

    erc20.initialize()
    return erc20
  },
  (...args) => JSON.stringify(args)
)

function getMultiplierDecimals(ticker: Ticker): BigNumber {
  return new BigNumber(10).pow(getERC20Metadata(ticker).decimals)
}

function toDecimal(atomicAmount: BigNumber, ticker: Ticker): BigNumber {
  return atomicAmount.div(new BigNumber(10).pow(getERC20Metadata(ticker).decimals))
}

function toDecimalString(atomicAmount: BigNumber, ticker: Ticker): string {
  return toDecimal(atomicAmount, ticker).toString(10)
}

function toAtomic(decimalAmount: BigNumber, ticker: Ticker): string {
  return toAtomicAmount(decimalAmount, getERC20Metadata(ticker).decimals).toString(10)
}

function toAtomicAmount(decimalAmount: BigNumber, decimals: number): BigNumber {
  return new BigNumber(String(decimalAmount)).multipliedBy(new BigNumber(10).pow(decimals))
}

function usdcFromAtomic(amount: string | BigNumber): string {
  return new BigNumber(String(amount)).div(decimals.toString()).toString(10)
}

function usdcToAtomic(amount: string | BigNumber): string {
  return new BigNumber(String(amount)).multipliedBy(decimals.toString()).toString(10)
}

function usdcToFidu(usdcAmount: BigNumber): BigNumber {
  return usdcAmount.multipliedBy(FIDU_DECIMALS).dividedBy(decimals.toString())
}

function fiduToUsdc(fiduAmount: BigNumber): BigNumber {
  return fiduAmount.multipliedBy(decimals.toString()).dividedBy(FIDU_DECIMALS)
}

function getNumSharesFromUsdc(usdcAmount: BigNumber, sharePrice: BigNumber): BigNumber {
  return (
    usdcToFidu(usdcAmount)
      .multipliedBy(
        // This might be better thought of as multiplying by the share-price mantissa,
        // which happens to be the same as `FIDU_DECIMALS`.
        FIDU_DECIMALS
      )
      // We use `.dividedToIntegerBy()` rather than `.dividedBy()` because we want to end
      // up with an integer, for the sake of parity with how num shares are represented
      // in the EVM, namely as a 256-bit integer.
      .dividedToIntegerBy(sharePrice)
  )
}

function getUsdcFromNumShares(fiduAmount: BigNumber, sharePrice: BigNumber): BigNumber {
  return fiduToUsdc(fiduAmount).multipliedBy(sharePrice).dividedToIntegerBy(
    // This might be better thought of as dividing by the share-price mantissa,
    // which happens to be the same as `FIDU_DECIMALS`.
    FIDU_DECIMALS
  )
}

function getUsdcAmountNetOfProtocolFee(usdcAmount: BigNumber): BigNumber {
  return usdcAmount.multipliedBy(995).dividedToIntegerBy(1000)
}

function minimumNumber(...args) {
  return BigNumber.minimum(...args).toString(10)
}

export {
  getERC20,
  getERC20Metadata,
  decimals,
  getMultiplierDecimals,
  toAtomic,
  toAtomicAmount,
  toDecimal,
  toDecimalString,
  usdcFromAtomic,
  usdcToAtomic,
  usdcToFidu,
  getNumSharesFromUsdc,
  getUsdcFromNumShares,
  getUsdcAmountNetOfProtocolFee,
  minimumNumber,
  Ticker,
  ERC20,
  USDC,
}
