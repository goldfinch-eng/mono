import BigNumber from "bignumber.js"
import {Contract} from "web3-eth-contract"
import {BORROWER_CREATED_EVENT, POOL_CREATED_EVENT} from "../types/events"
import {Web3IO} from "../types/web3"
import {BlockInfo} from "../utils"
import {CreditLine} from "./creditLine"
import {ERC20, Ticker} from "./erc20"
import {GoldfinchProtocol} from "./GoldfinchProtocol"
import {getOneInchContract, OneInchExpectedReturn} from "./oneInch"
import {PoolState, TranchedPool} from "./tranchedPool"
import {Borrower} from "@goldfinch-eng/protocol/typechain/web3/Borrower"
import {NonPayableTransactionObject} from "@goldfinch-eng/protocol/typechain/web3/types"

export type SubmittedBorrowerTx = (() => Promise<unknown>) | NonPayableTransactionObject<void>

class BorrowerInterface {
  userAddress: string
  borrowerContract: Web3IO<Borrower>
  usdc: ERC20
  goldfinchProtocol: GoldfinchProtocol
  oneInch: Web3IO<Contract>
  borrowerAddress: string
  creditLinesAddresses!: string[]
  borrowerPoolAddresses!: string[]
  tranchedPools!: {[address: string]: TranchedPool}
  tranchedPoolByCreditLine!: {[address: string]: TranchedPool}
  allowance!: BigNumber

  constructor(
    userAddress: string,
    borrowerContract: Web3IO<Borrower>,
    goldfinchProtocol: GoldfinchProtocol,
    oneInch: Web3IO<Contract>
  ) {
    this.userAddress = userAddress
    this.borrowerContract = borrowerContract
    this.goldfinchProtocol = goldfinchProtocol
    this.usdc = goldfinchProtocol.getERC20(Ticker.USDC)
    this.oneInch = oneInch
    this.borrowerAddress = this.borrowerContract.readOnly.options.address
    this.tranchedPools = {}
    this.tranchedPoolByCreditLine = {}
    this.creditLinesAddresses = []
  }

  async initialize(currentBlock: BlockInfo) {
    let poolEvents = await this.goldfinchProtocol.queryEvents(
      "GoldfinchFactory",
      [POOL_CREATED_EVENT],
      {
        borrower: [this.borrowerAddress, this.userAddress],
      },
      currentBlock.number
    )
    this.borrowerPoolAddresses = poolEvents.map((e: any) => e.returnValues.pool)
    for (let address of this.borrowerPoolAddresses) {
      const tranchedPool = new TranchedPool(address, this.goldfinchProtocol)
      await tranchedPool.initialize(currentBlock)
      this.creditLinesAddresses.push(tranchedPool.creditLineAddress)
      this.tranchedPoolByCreditLine[tranchedPool.creditLineAddress] = tranchedPool
      this.tranchedPools[address] = tranchedPool
    }
    this.allowance = await this.usdc.getAllowance(
      {owner: this.userAddress, spender: this.borrowerAddress},
      currentBlock
    )
  }

  private getPoolFromCL(address: string): TranchedPool {
    const pool = this.tranchedPoolByCreditLine[address]
    if (pool) {
      return pool
    } else {
      throw new Error(`Tranched pool is undefined for address: ${address}`)
    }
  }

  getPoolAddress(clAddress: string): string {
    const pool = this.getPoolFromCL(clAddress)
    return pool.address
  }

  getPoolPaused(clAddress: string): boolean {
    const pool = this.getPoolFromCL(clAddress)
    return pool.isPaused
  }

  getPoolDrawdownsPaused(clAddress: string): boolean {
    const pool = this.getPoolFromCL(clAddress)
    return pool.drawdownsPaused
  }

  getPoolState(clAddress: string): PoolState {
    const pool = this.getPoolFromCL(clAddress)
    return pool.poolState
  }

  getPoolDrawdownDisabled(clAddress: string): boolean {
    return (
      this.getPoolState(clAddress) < PoolState.JuniorLocked ||
      this.getPoolPaused(clAddress) ||
      this.getPoolDrawdownsPaused(clAddress)
    )
  }

  getPoolAmountAvailableForDrawdownInDollars(clAddress: string): BigNumber {
    const pool = this.getPoolFromCL(clAddress)
    return pool.amountAvailableForDrawdownInDollars
  }

  getAvailableToBorrowInDollarsForCreditLine(creditLine: CreditLine): BigNumber {
    // The CreditLine contract maintains its own understanding of how much is available to borrow, based
    // on its understanding of the limit and its accounting that tracks how much has been borrowed and how
    // much has been repaid. This is what is captured by `creditLine.availableCredit`.
    //
    // But that value is not the only applicable constraint on how much the borrower using this UI could
    // drawdown right now. In that regard, the borrower is also limited by the amount of funds that is
    // actually available right now in the TranchedPool contract that could be additionally drawndown. How
    // could that amount differ from `creditLine.availableCredit`? Consider the state where the Senior Pool
    // has not yet invested in the senior tranche: (assuming a typical case) the amount of funds in the
    // pool is going to be much less than what the limit is meant to accommodate, namely the impending additional
    // investment by the Senior Pool according to the leverage ratio into the senior tranche.
    //
    // So the amount we feature in the UI as what the borrower could borrow right now is
    // going to be the lesser of these two things.
    return BigNumber.min(
      this.getPoolAmountAvailableForDrawdownInDollars(creditLine.address),
      creditLine.availableCreditInDollars
    )
  }

  drawdown(creditLineAddress: string, drawdownAmount: string, sendToAddress: string) {
    sendToAddress = sendToAddress || this.userAddress
    return this.borrowerContract.userWallet.methods.drawdown(
      this.getPoolAddress(creditLineAddress),
      drawdownAmount,
      sendToAddress
    )
  }

  async drawdownViaOneInch(creditLineAddress: string, amount: string, sendToAddress: string, toToken: string) {
    sendToAddress = sendToAddress || this.userAddress
    const unsentAction = await this.drawdownViaOneInchAsync(
      this.getPoolAddress(creditLineAddress),
      amount,
      sendToAddress,
      toToken
    )
    return unsentAction
  }

  pay(creditLineAddress: string, amount: string) {
    return this.borrowerContract.userWallet.methods["pay(address,uint256)"](
      this.getPoolAddress(creditLineAddress),
      amount
    )
  }

  payInFull(creditLineAddress: string, amount: string) {
    return this.borrowerContract.userWallet.methods.payInFull(this.getPoolAddress(creditLineAddress), amount)
  }

  payMultiple(creditLines: string[], amounts: string[]) {
    let poolAddresses = creditLines.map((a) => this.getPoolAddress(a))
    return this.borrowerContract.userWallet.methods.payMultiple(poolAddresses, amounts)
  }

  payWithSwapOnOneInch(
    creditLineAddress: string,
    amount: string,
    minAmount: string,
    fromToken: string,
    quote: OneInchExpectedReturn
  ) {
    return this.borrowerContract.userWallet.methods.payWithSwapOnOneInch(
      this.getPoolAddress(creditLineAddress),
      amount,
      fromToken,
      minAmount,
      quote.distribution
    )
  }

  payMultipleWithSwapOnOneInch(
    creditLines: string[],
    amounts: string[],
    originAmount: string,
    fromToken: string,
    quote: OneInchExpectedReturn
  ) {
    return this.borrowerContract.userWallet.methods.payMultipleWithSwapOnOneInch(
      creditLines.map(this.getPoolAddress),
      amounts,
      originAmount,
      fromToken,
      quote.distribution
    )
  }

  async drawdownViaOneInchAsync(
    creditLineAddress: string,
    amount: string,
    sendToAddress: string,
    toToken: string
  ): Promise<NonPayableTransactionObject<void>> {
    toToken = toToken || "0xdac17f958d2ee523a2206206994597c13d831ec7" // Mainnet USDT
    const splitParts = 10

    const result = await this.oneInch.userWallet.methods
      .getExpectedReturn(this.usdc.address, toToken, amount, splitParts, 0)
      .call(undefined, "latest")
    return this.borrowerContract.userWallet.methods.drawdownWithSwapOnOneInch(
      this.getPoolAddress(creditLineAddress),
      amount,
      sendToAddress,
      toToken,
      this.withinOnePercent(result.returnAmount),
      result.distribution
    )
  }

  withinOnePercent(amount): string {
    return new BigNumber(amount).times(new BigNumber(99)).idiv(new BigNumber(100)).toString()
  }
}

async function getBorrowerContract(
  ownerAddress: string,
  goldfinchProtocol: GoldfinchProtocol,
  currentBlock: BlockInfo
): Promise<BorrowerInterface | undefined> {
  const borrowerCreatedEvents = await goldfinchProtocol.queryEvents(
    "GoldfinchFactory",
    [BORROWER_CREATED_EVENT],
    {
      owner: ownerAddress,
    },
    currentBlock.number
  )
  let borrower: Web3IO<Borrower> | null = null
  if (borrowerCreatedEvents.length > 0) {
    const lastIndex = borrowerCreatedEvents.length - 1
    const lastEvent = borrowerCreatedEvents[lastIndex]
    if (lastEvent) {
      borrower = goldfinchProtocol.getContract<Borrower>("Borrower", lastEvent.returnValues.borrower)
      const oneInch = getOneInchContract(goldfinchProtocol.networkId)
      const borrowerInterface = new BorrowerInterface(ownerAddress, borrower, goldfinchProtocol, oneInch)
      await borrowerInterface.initialize(currentBlock)
      return borrowerInterface
    } else {
      throw new Error("Failed to index into `borrowerCreatedEvents`.")
    }
  }
  return
}

export {getBorrowerContract, BorrowerInterface}
