import BigNumber from "bignumber.js"
import {ERC20, Tickers, usdcFromAtomic} from "./erc20"
import _ from "lodash"
import {getFromBlock, MAINNET} from "./utils"
import {mapEventsToTx} from "./events"
import {BorrowerInterface, getBorrowerContract} from "./borrower"
import {SeniorPool} from "./pool"
import {GoldfinchProtocol} from "./GoldfinchProtocol"
import {GoldfinchConfig} from "../typechain/web3/GoldfinchConfig"

declare let window: any

const UNLOCK_THRESHOLD = new BigNumber(10000)

async function getUserData(address, goldfinchProtocol, pool: SeniorPool, creditDesk, networkId): Promise<User> {
  const borrower = await getBorrowerContract(address, goldfinchProtocol)

  const user = new Web3User(address, pool, creditDesk, goldfinchProtocol, networkId, borrower)
  await user.initialize()
  return user
}

export interface UnlockedStatus {
  unlockAddress: string
  isUnlocked: boolean
}

interface User {
  address: string
  web3Connected: boolean
  loaded: boolean
  networkId: string
  usdcBalance: BigNumber
  usdcBalanceInDollars: BigNumber
  poolAllowance: BigNumber
  pastTxs: any[]
  poolTxs: any[]
  goListed: boolean
  noWeb3: boolean

  initialize(): Promise<void>
  usdcIsUnlocked(type: string): boolean
  getUnlockStatus(type: string): UnlockedStatus
  isUnlocked(allowance): boolean
  poolBalanceAsOf(dt): BigNumber
  getAllowance(address): Promise<BigNumber>
}

class Web3User implements User {
  address: string
  web3Connected: boolean
  loaded: boolean
  networkId: string
  usdcBalance!: BigNumber
  usdcBalanceInDollars!: BigNumber
  poolAllowance!: BigNumber
  pastTxs!: any[]
  poolTxs!: any[]
  goListed!: boolean
  noWeb3: boolean
  goldfinchProtocol: GoldfinchProtocol

  private borrower?: BorrowerInterface
  private pool: SeniorPool
  private usdc: ERC20
  private creditDesk: any

  constructor(
    address: string,
    pool: SeniorPool,
    creditDesk: any,
    goldfinchProtocol: GoldfinchProtocol,
    networkId: string,
    borrower?: BorrowerInterface,
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
    this.noWeb3 = !window.ethereum
  }

  async initialize() {
    this.usdcBalance = await this.usdc.getBalance(this.address)
    this.usdcBalanceInDollars = new BigNumber(usdcFromAtomic(this.usdcBalance))
    this.poolAllowance = await this.getAllowance(this.pool.address)

    const [usdcTxs, poolTxs, creditDeskTxs, tranchedPoolTxs] = await Promise.all([
      // NOTE: We have no need to include usdc txs for `this.pool.v1Pool` among the txs in
      // `this.pastTxs`. So we don't get them. We only need usdc txs for `this.pool`.
      getAndTransformERC20Events(this.usdc, this.pool.address, this.address),
      getAndTransformPoolEvents(this.pool, this.address),
      // Credit desk events could've come from the user directly or the borrower contract, we need to filter by both
      getAndTransformCreditDeskEvents(this.creditDesk, _.compact([this.address, this.borrower?.borrowerAddress])),
      getTranchedPoolEvents(this.goldfinchProtocol, this.borrower?.tranchedPools),
    ])
    this.pastTxs = _.reverse(
      _.sortBy(_.compact(_.concat(usdcTxs, poolTxs, creditDeskTxs, tranchedPoolTxs)), "blockNumber"),
    )
    this.poolTxs = poolTxs
    this.goListed = await this.isGoListed(this.address)
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

  private async isGoListed(address) {
    if (process.env.REACT_APP_ENFORCE_GO_LIST || this.networkId === MAINNET) {
      let config = this.goldfinchProtocol.getContract<GoldfinchConfig>("GoldfinchConfig")
      return await config.methods.goList(address).call()
    } else {
      return true
    }
  }

  poolBalanceAsOf(dt) {
    const filtered = _.filter(this.poolTxs, (tx) => {
      return tx.blockTime < dt
    })
    if (!filtered.length) {
      return new BigNumber(0)
    }
    return BigNumber.sum.apply(
      null,
      filtered.map((tx) => {
        if (tx.type === "WithdrawalMade") {
          return tx.amountBN.multipliedBy(new BigNumber(-1))
        } else {
          return tx.amountBN
        }
      }),
    )
  }

  async getAllowance(address) {
    return this.usdc.getAllowance({owner: this.address, spender: address})
  }
}

class DefaultUser implements User {
  address: string
  web3Connected: boolean
  loaded: boolean
  networkId: string
  usdcBalance: BigNumber
  usdcBalanceInDollars: BigNumber
  poolAllowance: BigNumber
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
    this.pastTxs = []
    this.poolTxs = []
    this.goListed = false
  }

  async initialize() {}
  usdcIsUnlocked(type: string) {
    return false
  }
  getUnlockStatus(type: string): UnlockedStatus {
    return {unlockAddress: "", isUnlocked: false}
  }
  isUnlocked(allowance): boolean {
    return false
  }
  poolBalanceAsOf(dt): BigNumber {
    return new BigNumber(0)
  }
  async getAllowance(address) {
    return new BigNumber(0)
  }
}

function defaultUser(): User {
  return new DefaultUser()
}

async function getAndTransformERC20Events(erc20: ERC20, spender: string, owner: string) {
  let approvalEvents = await erc20.contract.getPastEvents("Approval", {
    filter: {owner, spender},
    fromBlock: "earliest",
    toBlock: "latest",
  })
  approvalEvents = _.chain(approvalEvents)
    .compact()
    .map((e) => _.set(e, "erc20", erc20))
    .value()
  return await mapEventsToTx(approvalEvents)
}

async function getAndTransformPoolEvents(pool: SeniorPool, address: string) {
  const poolEvents = await pool.getPoolEvents(address)
  return await mapEventsToTx(poolEvents)
}

async function getAndTransformCreditDeskEvents(creditDesk, address) {
  const fromBlock = getFromBlock(creditDesk.chain)
  const [paymentEvents, drawdownEvents] = await Promise.all(
    ["PaymentCollected", "DrawdownMade"].map((eventName) => {
      return creditDesk.getPastEvents(eventName, {
        filter: {payer: address, borrower: address},
        fromBlock: fromBlock,
        to: "latest",
      })
    }),
  )
  const creditDeskEvents = _.compact(_.concat(paymentEvents, drawdownEvents))
  return await mapEventsToTx(creditDeskEvents)
}

async function getTranchedPoolEvents(goldfinchProtocol, tranchedPools, events = ["DepositMade", "WithdrawalMade"]) {
  const tranchedPoolsAddresses = Object.keys(tranchedPools)
  let combinedEvents = _.flatten(
    await Promise.all(
      tranchedPoolsAddresses.map((address) => goldfinchProtocol.queryEvents(tranchedPools[address].contract, events)),
    ),
  )
  return await mapEventsToTx(combinedEvents)
}

export {getUserData, defaultUser}
export type {DefaultUser, User}
