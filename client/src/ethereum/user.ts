import BigNumber from "bignumber.js"
import { ERC20, usdcFromAtomic } from "./erc20"
import _ from "lodash"
import { getFromBlock, MAINNET } from "./utils"
import { mapEventsToTx } from "./events"
import { getGoldfinchFactory } from "./creditLine"
import { getBorrowerContract } from "./borrower"
import { goList } from "../goList"

declare let window: any;

const UNLOCK_THRESHOLD = new BigNumber(10000)

async function getUserData(address, usdc, pool, creditDesk, networkId): Promise<User> {
  const goldfinchFactory = await getGoldfinchFactory(networkId)
  const borrower = await getBorrowerContract(address, goldfinchFactory, creditDesk, usdc, pool, networkId)

  const user = new Web3User(address, borrower, pool, creditDesk, usdc, networkId)
  await user.initialize()
  return user
}

interface UnlockedStatus {
  unlockAddress: string,
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
  pastTXs: any[]
  poolTxs: any[]
  goListed: boolean
  noWeb3: boolean

  initialize(): Promise<void>
  usdcIsUnlocked(type: string): boolean
  getUnlockStatus(type: string): UnlockedStatus
  isUnlocked(allowance): boolean
  isGoListed(address): Promise<boolean>
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
  pastTXs!: any[]
  poolTxs!: any[]
  goListed!: boolean
  noWeb3: boolean

  private borrower: BorrowerInterface
  private pool: any
  private usdc: ERC20
  private creditDesk: any

  constructor(address: string, borrower: BorrowerInterface, pool: any, creditDesk: any, usdc: ERC20, networkId: string) {
    this.address = address
    this.borrower = borrower
    this.pool = pool
    this.usdc = usdc
    this.creditDesk = creditDesk
    this.web3Connected = true
    this.loaded = false
    this.networkId = networkId
    this.noWeb3 = !window.ethereum
  }

  async initialize() {
    this.usdcBalance = await this.usdc.getBalance(this.address)
    this.usdcBalanceInDollars = new BigNumber(usdcFromAtomic(this.usdcBalance))
    this.poolAllowance = await this.getAllowance(this.pool._address)

    const [usdcTxs, poolTxs, creditDeskTxs] = await Promise.all([
      getAndTransformERC20Events(this.usdc, this.pool._address, this.address),
      getAndTransformPoolEvents(this.pool, this.address),
      // Credit desk events could've some from the user directly or the borrower contract, we need to filter by both
      getAndTransformCreditDeskEvents(this.creditDesk, [this.address, this.borrower.borrowerAddress]),
    ])
    this.pastTXs = _.reverse(_.sortBy(_.compact(_.concat(usdcTxs, poolTxs, creditDeskTxs)), "blockNumber"))
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
        unlockAddress: this.pool._address,
        isUnlocked: this.isUnlocked(this.poolAllowance),
      }
    } else if (type === "borrow") {
      return {
        unlockAddress: this.borrower.borrowerAddress,
        isUnlocked: this.isUnlocked(this.borrower.allowance),
      }
    }
    throw new Error("Invalid type")
  }

  isUnlocked(allowance) {
    return !allowance || allowance.gte(UNLOCK_THRESHOLD)
  }

  async isGoListed(address) {
    if (process.env.REACT_APP_ENFORCE_GO_LIST || this.networkId === MAINNET) {
      return goList.map(_.toLower).includes(_.toLower(address))
    } else {
      return true
    }
  }

  poolBalanceAsOf(dt) {
    const filtered = _.filter(this.poolTxs, tx => {
      return tx.blockTime < dt
    })
    if (!filtered.length) {
      return new BigNumber(0)
    }
    return BigNumber.sum.apply(
      null,
      filtered.map(tx => {
        if (tx.type === "WithdrawalMade") {
          return tx.amountBN.multipliedBy(new BigNumber(-1))
        } else {
          return tx.amountBN
        }
      }),
    )
  }

  async getAllowance(address) {
    return this.usdc.getAllowance({ owner: this.address, spender: address })
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
  pastTXs: any[]
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
    this.pastTXs = []
    this.poolTxs = []
    this.goListed = false
  }

  async initialize() {}
  usdcIsUnlocked(type: string) { return false }
  getUnlockStatus(type: string): UnlockedStatus {
    return {unlockAddress: "", isUnlocked: false}
  }
  isUnlocked(allowance): boolean { return false }
  async isGoListed(address) {return false}
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

async function getAndTransformERC20Events(erc20, spender, owner) {
  let approvalEvents = await erc20.contract.getPastEvents("Approval", {
    filter: { owner: owner, spender: spender },
    fromBlock: "earliest",
    to: "latest",
  })
  approvalEvents = _.chain(approvalEvents)
    .compact()
    .map(e => _.set(e, "erc20", erc20))
    .value()
  return await mapEventsToTx(approvalEvents)
}

async function getAndTransformPoolEvents(pool, address) {
  const poolEvents = await getPoolEvents(pool, address)
  return await mapEventsToTx(poolEvents)
}

async function getAndTransformCreditDeskEvents(creditDesk, address) {
  const fromBlock = getFromBlock(creditDesk.chain)
  const [paymentEvents, drawdownEvents] = await Promise.all(
    ["PaymentCollected", "DrawdownMade"].map(eventName => {
      return creditDesk.getPastEvents(eventName, {
        filter: { payer: address, borrower: address },
        fromBlock: fromBlock,
        to: "latest",
      })
    }),
  )
  const creditDeskEvents = _.compact(_.concat(paymentEvents, drawdownEvents))
  return await mapEventsToTx(creditDeskEvents)
}

async function getPoolEvents(pool, address, events = ["DepositMade", "WithdrawalMade"]) {
  const fromBlock = getFromBlock(pool.chain)
  const [depositEvents, withdrawalEvents] = await Promise.all(
    events.map(eventName => {
      return pool.getPastEvents(eventName, {
        filter: { capitalProvider: address },
        fromBlock: fromBlock,
        to: "latest",
      })
    }),
  )
  return _.compact(_.concat(depositEvents, withdrawalEvents))
}

export { getUserData, getPoolEvents, defaultUser }
export type { DefaultUser, User }

