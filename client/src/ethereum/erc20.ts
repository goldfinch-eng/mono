import web3 from "../web3"
import BigNumber from "bignumber.js"
import * as ERC20Contract from "./ERC20.json"
import { decimals, USDC_ADDRESSES, USDT_ADDRESSES, BUSD_ADDRESSES, getDeployments } from "./utils"
import { memoize } from "lodash"
import { Contract } from "web3-eth-contract"
import {AbiItem} from "web3-utils/types"

const Tickers = {
  USDC: "USDC",
  USDT: "USDT",
  BUSD: "BUSD",
}

class ERC20 {
  ticker: string
  networkId: string
  networksToAddress: any
  localContractName?: string
  decimals: number
  contract!: Contract

  constructor(networkId) {
    this.ticker = "ERC20"
    this.networkId = networkId
    this.networksToAddress = {}
    this.decimals = 18
  }

  async initialize() {
    if (!this.contract) {
      this.contract = await this.initializeContract(this.networkId)
    }
  }

  async initializeContract(networkId) {
    console.log('[DELETE ME] inside initializeContract(). networkId:', networkId)
    const config = await getDeployments(networkId)
    const localContract = this.localContractName && config.contracts[this.localContractName]
    let address
    if (localContract) {
      address = localContract.address
    } else {
      if (process.env.REACT_APP_HARDHAT_FORK) {
        address = this.networksToAddress[process.env.REACT_APP_HARDHAT_FORK]
      } else {
        // Assume we're on testnet or mainnet
        address = this.networksToAddress[this.networkId]
      }
    }
    const erc20 = new web3.eth.Contract(ERC20Contract.abi as AbiItem[], address)
    return erc20
  }

  get address() {
    return this.contract.options.address
  }

  async getAllowance(opts): Promise<BigNumber> {
    const { owner, spender } = opts
    return new BigNumber(await this.contract.methods.allowance(owner, spender).call())
  }

  async getBalance(address): Promise<BigNumber> {
    return new BigNumber(await this.contract.methods.balanceOf(address).call())
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
  constructor(networkId) {
    super(networkId)
    this.ticker = Tickers.USDC
    this.networksToAddress = USDC_ADDRESSES
    this.localContractName = "TestERC20"
    this.decimals = 6
  }
}

class USDT extends ERC20 {
  constructor(networkId) {
    super(networkId)
    this.ticker = Tickers.USDT
    this.networksToAddress = USDT_ADDRESSES
    this.decimals = 6
  }
}

class BUSD extends ERC20 {
  constructor(networkId) {
    super(networkId)
    this.ticker = Tickers.BUSD
    this.networksToAddress = BUSD_ADDRESSES
    this.decimals = 18
  }
}

let getERC20 = memoize(
  async (ticker, networkId) => {
    let erc20
    switch (ticker) {
      case Tickers.USDC:
        erc20 = new USDC(networkId)
        break
      case Tickers.USDT:
        erc20 = new USDT(networkId)
        break
      case Tickers.BUSD:
        erc20 = new BUSD(networkId)
        break
      default:
        throw new Error("Unsupported currency")
    }

    await erc20.initialize()
    return erc20
  },
  (...args) => JSON.stringify(args),
)

async function getUSDC(networkId) {
  return getERC20(Tickers.USDC, networkId)
}

function usdcFromAtomic(amount) {
  return new BigNumber(String(amount)).div(decimals.toString()).toString(10)
}

function usdcToAtomic(amount) {
  return new BigNumber(String(amount)).multipliedBy(decimals.toString()).toString(10)
}

function minimumNumber(...args) {
  return BigNumber.minimum(...args).toString(10)
}

export { getUSDC, getERC20, decimals, usdcFromAtomic, usdcToAtomic, minimumNumber, Tickers, ERC20}
