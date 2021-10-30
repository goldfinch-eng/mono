import {CreditDesk} from "@goldfinch-eng/protocol/typechain/web3/CreditDesk"
import {GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/web3/GoldfinchConfig"
import BigNumber from "bignumber.js"
import _ from "lodash"
import {EventData} from "web3-eth-contract"
import {assertWithLoadedInfo, Loadable, WithLoadedInfo} from "../types/loadable"
import {BlockInfo} from "../utils"
import {BorrowerInterface, getBorrowerContract} from "./borrower"
import {ERC20, Tickers, usdcFromAtomic} from "./erc20"
import {getBalanceAsOf, mapEventsToTx} from "./events"
import {GFILoaded} from "./gfi"
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
  gfi: GFILoaded,
  currentBlock: BlockInfo
): Promise<UserLoaded> {
  const borrower = await getBorrowerContract(address, goldfinchProtocol, currentBlock)

  const user = new User(address, networkId, creditDesk, goldfinchProtocol, borrower)
  await user.initialize(pool, gfi, currentBlock)
  assertWithLoadedInfo(user)
  return user
}

export interface UnlockedStatus {
  unlockAddress: string
  isUnlocked: boolean
}

type UserLoadedInfo = {
  currentBlock: BlockInfo
  usdcBalance: BigNumber
  usdcBalanceInDollars: BigNumber
  poolAllowance: BigNumber
  poolEvents: EventData[]
  pastTxs: any[]
  poolTxs: any[]
  goListed: boolean
  gfiBalance: BigNumber
  usdcIsUnlocked: {
    earn: {
      unlockAddress: string
      isUnlocked: boolean
    }
    borrow: {
      unlockAddress: string
      isUnlocked: boolean
    }
  }
}

export type UserLoaded = WithLoadedInfo<User, UserLoadedInfo>

export class User {
  address: string
  web3Connected: boolean
  networkId: string
  noWeb3: boolean
  borrower: BorrowerInterface | undefined
  info: Loadable<UserLoadedInfo>

  goldfinchProtocol: GoldfinchProtocol

  private creditDesk: CreditDesk

  constructor(
    address: string,
    networkId: string,
    creditDesk: CreditDesk,
    goldfinchProtocol: GoldfinchProtocol,
    borrower: BorrowerInterface | undefined
  ) {
    if (!address) {
      throw new Error("User must have an address.")
    }
    this.address = address
    this.web3Connected = true
    this.networkId = networkId
    this.noWeb3 = !window.ethereum
    this.borrower = borrower
    this.goldfinchProtocol = goldfinchProtocol
    this.creditDesk = creditDesk
    this.info = {
      loaded: false,
      value: undefined,
    }
  }

  async initialize(pool: SeniorPoolLoaded, gfi: GFILoaded, currentBlock: BlockInfo) {
    const usdc = this.goldfinchProtocol.getERC20(Tickers.USDC)
    const poolBlockNumber = pool.info.value.currentBlock.number
    const gfiBlockNumber = gfi.info.value.currentBlock.number
    if (poolBlockNumber !== currentBlock.number) {
      throw new Error("`pool` is not based on current block number.")
    }
    if (poolBlockNumber !== gfiBlockNumber) {
      throw new Error("`pool` and `gfi` are not based on the same block number.")
    }

    const usdcBalance = await usdc.getBalance(this.address, currentBlock)
    const usdcBalanceInDollars = new BigNumber(usdcFromAtomic(usdcBalance))
    const poolAllowance = await usdc.getAllowance({owner: this.address, spender: pool.address}, currentBlock)

    const [usdcTxs, poolEvents, creditDeskTxs] = await Promise.all([
      // NOTE: We have no need to include usdc txs for `pool.v1Pool` among the txs in
      // `this.pastTxs`. So we don't get them. We only need usdc txs for `this.pool`.
      getAndTransformERC20Events(usdc, pool.address, this.address, currentBlock),
      getPoolEvents(pool, this.address, currentBlock),
      // Credit desk events could've come from the user directly or the borrower contract, we need to filter by both
      getAndTransformCreditDeskEvents(
        this.creditDesk,
        _.compact([this.address, this.borrower?.borrowerAddress]),
        currentBlock
      ),
    ])
    const poolTxs = await mapEventsToTx(poolEvents)
    const pastTxs = _.reverse(_.sortBy(_.compact(_.concat(usdcTxs, poolTxs, creditDeskTxs)), "blockNumber"))
    const goListed = await this.isGoListed(this.address, currentBlock)
    const gfiBalance = new BigNumber(
      await gfi.contract.methods.balanceOf(this.address).call(undefined, currentBlock.number)
    )
    this.info = {
      loaded: true,
      value: {
        currentBlock,
        usdcBalance,
        usdcBalanceInDollars,
        poolAllowance,
        poolEvents,
        pastTxs,
        poolTxs,
        goListed,
        gfiBalance,
        usdcIsUnlocked: {
          earn: {
            unlockAddress: pool.address,
            isUnlocked: this.isUnlocked(poolAllowance),
          },
          borrow: {
            unlockAddress: this.borrower?.borrowerAddress || this.address,
            isUnlocked: this.borrower?.allowance ? this.isUnlocked(this.borrower.allowance) : false,
          },
        },
      },
    }
  }

  isUnlocked(allowance: BigNumber | undefined) {
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
    assertWithLoadedInfo(this)
    return getBalanceAsOf(this.info.value.poolEvents, blockNumExclusive, "WithdrawalMade")
  }
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
