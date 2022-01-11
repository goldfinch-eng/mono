import {assertUnreachable} from "@goldfinch-eng/utils/src/type"
import BigNumber from "bignumber.js"
import {memoize} from "lodash"
import {Contract} from "web3-eth-contract"
import {AbiItem} from "web3-utils/types"
import {Web3IO} from "../types/web3"
import {BlockInfo} from "../utils"
import web3 from "../web3"
import * as ERC20Contract from "./ERC20.json"
import {FIDU_DECIMALS} from "./fidu"
import {GoldfinchProtocol} from "./GoldfinchProtocol"
import {BUSD_ADDRESSES, decimals, USDC_ADDRESSES, USDT_ADDRESSES} from "./utils"

const Tickers: Record<Ticker, Ticker> = {
  USDC: "USDC",
  USDT: "USDT",
  BUSD: "BUSD",
}
export type Ticker = "USDC" | "USDT" | "BUSD"

abstract class ERC20 {
  name: string
  ticker: Ticker
  networksToAddress: any
  localContractName?: string
  permitVersion?: string
  decimals: number
  contract!: Web3IO<Contract>
  goldfinchProtocol: GoldfinchProtocol

  constructor(goldfinchProtocol, ticker: Ticker) {
    this.name = "ERC20"
    this.ticker = ticker
    this.goldfinchProtocol = goldfinchProtocol
    this.networksToAddress = {}
    this.decimals = 18
  }

  initialize() {
    this.contract = this.initializeContract()
  }

  initializeContract(): Web3IO<Contract> {
    const config = this.goldfinchProtocol.deployments
    const localContract = this.localContractName && config.contracts[this.localContractName]
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
  constructor(goldfinchProtocol: GoldfinchProtocol) {
    super(goldfinchProtocol, Tickers.USDC)
    this.name = "USD Coin"
    this.networksToAddress = USDC_ADDRESSES
    this.localContractName = "TestERC20"
    this.decimals = 6
    this.permitVersion = this.goldfinchProtocol.networkId === "localhost" ? "1" : "2"
  }
}

class USDT extends ERC20 {
  constructor(goldfinchProtocol: GoldfinchProtocol) {
    super(goldfinchProtocol, Tickers.USDT)
    this.name = "Tether USD"
    this.networksToAddress = USDT_ADDRESSES
    this.decimals = 6
  }
}

class BUSD extends ERC20 {
  constructor(goldfinchProtocol: GoldfinchProtocol) {
    super(goldfinchProtocol, Tickers.BUSD)
    this.name = "Binance USD"
    this.networksToAddress = BUSD_ADDRESSES
    this.decimals = 18
  }
}

let getERC20 = memoize(
  (ticker: Ticker, goldfinchProtocol: GoldfinchProtocol) => {
    let erc20
    switch (ticker) {
      case "USDC":
        erc20 = new USDC(goldfinchProtocol)
        break
      case "USDT":
        erc20 = new USDT(goldfinchProtocol)
        break
      case "BUSD":
        erc20 = new BUSD(goldfinchProtocol)
        break
      default:
        assertUnreachable(ticker)
    }

    erc20.initialize()
    return erc20
  },
  (...args) => JSON.stringify(args)
)

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
  decimals,
  usdcFromAtomic,
  usdcToAtomic,
  usdcToFidu,
  getNumSharesFromUsdc,
  getUsdcFromNumShares,
  getUsdcAmountNetOfProtocolFee,
  minimumNumber,
  Tickers,
  ERC20,
  USDC,
}
