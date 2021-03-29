import BigNumber from "bignumber.js"
import { usdcFromAtomic } from "./erc20.js"
import _ from "lodash"
import { getFromBlock } from "./utils.js"
import { mapEventsToTx } from "./events"
import { getCreditLineFactory } from "./creditLine"
import { getBorrowerContract } from "./borrower"

const UNLOCK_THRESHOLD = new BigNumber(10000)

async function getUserData(address, usdc, pool, creditDesk, networkId) {
  const creditLineFactory = await getCreditLineFactory(networkId)
  const borrower = await getBorrowerContract(address, creditLineFactory, creditDesk, usdc, pool, networkId)

  const user = new User(address, borrower, pool, creditDesk, usdc)
  await user.initialize()
  return user
}

class User {
  constructor(address, borrower, pool, creditDesk, usdc) {
    this.address = address
    this.borrower = borrower
    this.pool = pool
    this.usdc = usdc
    this.creditDesk = creditDesk
    this.loaded = false
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
    this.loaded = true
  }

  usdcIsUnlocked(type) {
    return this.getUnlockStatus(type).isUnlocked
  }

  getUnlockStatus(type) {
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
    return false
  }

  isUnlocked(allowance) {
    return !allowance || allowance.gte(UNLOCK_THRESHOLD)
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

function defaultUser() {
  return {
    loaded: true,
    poolBalanceAsOf: () => new BigNumber(0),
    usdcIsUnlocked: () => false,
    noWeb3: !window.ethereum,
  }
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
