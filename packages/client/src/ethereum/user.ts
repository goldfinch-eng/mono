import {CreditDesk} from "@goldfinch-eng/protocol/typechain/web3/CreditDesk"
import {GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/web3/GoldfinchConfig"
import BigNumber from "bignumber.js"
import _ from "lodash"
import {EventData} from "web3-eth-contract"
import {BlockInfo} from "../utils"
import {BorrowerInterface, getBorrowerContract} from "./borrower"
import {ERC20, Tickers, usdcFromAtomic} from "./erc20"
import {getBalanceAsOf, mapEventsToTx} from "./events"
import {GoldfinchProtocol} from "./GoldfinchProtocol"
import {SeniorPoolLoaded} from "./pool"
import {getFromBlock, MAINNET} from "./utils"

declare let window: any

export const UNLOCK_THRESHOLD = new BigNumber(10000)

export async function getUserData(
  address: string,
  goldfinchProtocol: GoldfinchProtocol,
  pool: SeniorPoolLoaded,
  creditDesk: CreditDesk,
  networkId: string,
  currentBlock: BlockInfo
): Promise<User> {
  const borrower = await getBorrowerContract(address, goldfinchProtocol, currentBlock)

  const user = new Web3User(address, pool, creditDesk, goldfinchProtocol, networkId, borrower)
  await user.initialize(currentBlock)
  return user
}

export interface UnlockedStatus {
  unlockAddress: string
  isUnlocked: boolean
}

export interface User {
  address: string
  web3Connected: boolean
  loaded: boolean
  networkId: string
  usdcBalance: BigNumber
  usdcBalanceInDollars: BigNumber
  poolAllowance: BigNumber
  poolEvents: EventData[]
  pastTxs: any[]
  poolTxs: any[]
  goListed: boolean
  noWeb3: boolean

  initialize(currentBlock: BlockInfo): Promise<void>
  usdcIsUnlocked(type: string): boolean
  getUnlockStatus(type: string): UnlockedStatus
  isUnlocked(allowance): boolean
  poolBalanceAsOf(blockNumExclusive: number): BigNumber
  getAllowance(address: string, currentBlock: BlockInfo): Promise<BigNumber>
}

class Web3User implements User {
  address: string
  web3Connected: boolean
  loaded: boolean
  networkId: string
  usdcBalance!: BigNumber
  usdcBalanceInDollars!: BigNumber
  poolAllowance!: BigNumber
  poolEvents: EventData[]
  pastTxs: any[]
  poolTxs: any[]
  goListed!: boolean
  noWeb3: boolean
  goldfinchProtocol: GoldfinchProtocol

  private borrower?: BorrowerInterface
  private pool: SeniorPoolLoaded
  private usdc: ERC20
  private creditDesk: any

  constructor(
    address: string,
    pool: SeniorPoolLoaded,
    creditDesk: CreditDesk,
    goldfinchProtocol: GoldfinchProtocol,
    networkId: string,
    borrower?: BorrowerInterface
  ) {
    this.address = address
    this.borrower = borrower
    this.goldfinchProtocol = goldfinchProtocol
    this.pool = pool
    this.usdc = goldfinchProtocol.getERC20(Tickers.USDC)
    this.creditDesk = creditDesk
    this.web3Connected = true
    this.loaded = false
    this.networkId = networkId
    this.poolEvents = []
    this.pastTxs = []
    this.poolTxs = []
    this.noWeb3 = !window.ethereum
  }

  async initialize(currentBlock: BlockInfo) {
    this.usdcBalance = await this.usdc.getBalance(this.address, currentBlock)
    this.usdcBalanceInDollars = new BigNumber(usdcFromAtomic(this.usdcBalance))
    this.poolAllowance = await this.getAllowance(this.pool.address, currentBlock)

    const [usdcTxs, poolEvents, creditDeskTxs] = await Promise.all([
      // NOTE: We have no need to include usdc txs for `this.pool.v1Pool` among the txs in
      // `this.pastTxs`. So we don't get them. We only need usdc txs for `this.pool`.
      getAndTransformERC20Events(this.usdc, this.pool.address, this.address, currentBlock),
      getPoolEvents(this.pool, this.address, currentBlock),
      // Credit desk events could've come from the user directly or the borrower contract, we need to filter by both
      getAndTransformCreditDeskEvents(
        this.creditDesk,
        _.compact([this.address, this.borrower?.borrowerAddress]),
        currentBlock
      ),
    ])
    const poolTxs = await mapEventsToTx(poolEvents)
    this.poolEvents = poolEvents
    this.poolTxs = poolTxs
    this.pastTxs = _.reverse(_.sortBy(_.compact(_.concat(usdcTxs, poolTxs, creditDeskTxs)), "blockNumber"))
    this.goListed = await this.isGoListed(this.address, currentBlock)
    this.loaded = true
  }

  usdcIsUnlocked(type) {
    return this.getUnlockStatus(type).isUnlocked
  }

  getUnlockStatus(type): UnlockedStatus {
    if (type === "earn") {
      return {
        unlockAddress: this.pool.address,
        isUnlocked: this.isUnlocked(this.poolAllowance),
      }
    } else if (type === "borrow") {
      return {
        unlockAddress: this.borrower?.borrowerAddress ?? this.address,
        isUnlocked: this.borrower?.allowance ? this.isUnlocked(this.borrower.allowance) : false,
      }
    }
    throw new Error("Invalid type")
  }

  isUnlocked(allowance) {
    return !allowance || allowance.gte(UNLOCK_THRESHOLD)
  }

  private async isGoListed(address: string, currentBlock: BlockInfo): Promise<boolean> {
    if (process.env.REACT_APP_ENFORCE_GO_LIST || this.networkId === MAINNET) {
      let config = this.goldfinchProtocol.getContract<GoldfinchConfig>("GoldfinchConfig")
      return await config.methods.goList(address).call(undefined, currentBlock.number)
    } else {
      return true
    }
  }

  poolBalanceAsOf(blockNumExclusive: number): BigNumber {
    return getBalanceAsOf(this.poolEvents, blockNumExclusive, "WithdrawalMade")
  }

  async getAllowance(address: string, currentBlock: BlockInfo) {
    return this.usdc.getAllowance({owner: this.address, spender: address}, currentBlock)
  }
}

export class DefaultUser implements User {
  address: string
  web3Connected: boolean
  loaded: boolean
  networkId: string
  usdcBalance: BigNumber
  usdcBalanceInDollars: BigNumber
  poolAllowance: BigNumber
  poolEvents: EventData[]
  pastTxs: any[]
  poolTxs: any[]
  goListed: boolean
  noWeb3: boolean

  constructor() {
    this.address = ""
    this.networkId = ""
    this.usdcBalance = new BigNumber(0)
    this.usdcBalanceInDollars = new BigNumber(0)
    this.loaded = false
    this.poolBalanceAsOf = () => new BigNumber(0)
    this.usdcIsUnlocked = () => false
    this.noWeb3 = !window.ethereum
    this.web3Connected = false
    this.poolAllowance = new BigNumber(0)
    this.poolEvents = []
    this.pastTxs = []
    this.poolTxs = []
    this.goListed = false
  }

  async initialize(currentBlock: BlockInfo) {}
  usdcIsUnlocked(type: string) {
    return false
  }
  getUnlockStatus(type: string): UnlockedStatus {
    return {unlockAddress: "", isUnlocked: false}
  }
  isUnlocked(allowance): boolean {
    return false
  }
  poolBalanceAsOf(blockNumExclusive: number): BigNumber {
    return new BigNumber(0)
  }
  async getAllowance(address: string, currentBlock: BlockInfo) {
    return new BigNumber(0)
  }
}

export function defaultUser(): User {
  return new DefaultUser()
}

async function getAndTransformERC20Events(erc20: ERC20, spender: string, owner: string, currentBlock: BlockInfo) {
  let approvalEvents = await erc20.contract.getPastEvents("Approval", {
    filter: {owner, spender},
    fromBlock: "earliest",
    toBlock: currentBlock.number,
  })
  approvalEvents = _.chain(approvalEvents)
    .compact()
    .map((e) => _.set(e, "erc20", erc20))
    .value()
  return await mapEventsToTx(approvalEvents)
}

async function getPoolEvents(pool: SeniorPoolLoaded, address: string, currentBlock: BlockInfo) {
  return await pool.getPoolEvents(address, ["DepositMade", "WithdrawalMade"], true, currentBlock.number)
}

async function getAndTransformCreditDeskEvents(creditDesk, address, currentBlock: BlockInfo) {
  const fromBlock = getFromBlock(creditDesk.chain)
  const [paymentEvents, drawdownEvents] = await Promise.all(
    ["PaymentCollected", "DrawdownMade"].map((eventName) => {
      return creditDesk.getPastEvents(eventName, {
        filter: {payer: address, borrower: address},
        fromBlock: fromBlock,
        to: currentBlock.number,
      })
    })
  )
  const creditDeskEvents = _.compact(_.concat(paymentEvents, drawdownEvents))
  return await mapEventsToTx(creditDeskEvents)
}
