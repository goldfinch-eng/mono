import {submitGaslessTransaction} from "./gasless"
import BigNumber from "bignumber.js"
import {getOneInchContract} from "./oneInch"
import {Contract} from "web3-eth-contract"
import {ERC20, Tickers} from "./erc20"
import {GoldfinchProtocol} from "./GoldfinchProtocol"
import {PoolState, TranchedPool} from "./tranchedPool"
import {BlockInfo} from "../utils"
import {BORROWER_CREATED_EVENT, POOL_CREATED_EVENT} from "./events"

class BorrowerInterface {
  userAddress: string
  borrowerContract: Contract
  usdc: ERC20
  goldfinchProtocol: GoldfinchProtocol
  oneInch: Contract
  borrowerAddress: string
  creditLinesAddresses!: string[]
  borrowerPoolAddresses!: string[]
  tranchedPools!: {[address: string]: TranchedPool}
  tranchedPoolByCreditLine!: {[address: string]: TranchedPool}
  allowance!: BigNumber

  constructor(
    userAddress: string,
    borrowerContract: Contract,
    goldfinchProtocol: GoldfinchProtocol,
    oneInch: Contract
  ) {
    this.userAddress = userAddress
    this.borrowerContract = borrowerContract
    this.goldfinchProtocol = goldfinchProtocol
    this.usdc = goldfinchProtocol.getERC20(Tickers.USDC)
    this.oneInch = oneInch
    this.borrowerAddress = this.borrowerContract.options.address
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
      if (tranchedPool.state >= PoolState.SeniorLocked) {
        this.creditLinesAddresses.push(tranchedPool.creditLineAddress)
      }
      this.tranchedPoolByCreditLine[tranchedPool.creditLineAddress] = tranchedPool
      this.tranchedPools[address] = tranchedPool
    }
    this.allowance = await this.usdc.getAllowance(
      {owner: this.userAddress, spender: this.borrowerAddress},
      currentBlock
    )
  }

  getPoolAddressFromCL(address: string): string {
    const pool = this.tranchedPoolByCreditLine[address]
    if (pool) {
      return pool.address
    } else {
      throw new Error(`Tranched pool is undefined for address: ${address}`)
    }
  }

  get shouldUseGasless(): boolean {
    return process.env.REACT_APP_DISABLE_GASLESS !== "true" && (window as any).disableGasless !== true
  }

  drawdown(creditLineAddress, drawdownAmount, sendToAddress) {
    sendToAddress = sendToAddress || this.userAddress
    return this.submit(
      this.borrowerContract.methods.drawdown(
        this.getPoolAddressFromCL(creditLineAddress),
        drawdownAmount,
        sendToAddress
      )
    )
  }

  drawdownViaOneInch(creditLineAddress, amount, sendToAddress, toToken) {
    sendToAddress = sendToAddress || this.userAddress
    return this.submit(
      this.drawdownViaOneInchAsync(this.getPoolAddressFromCL(creditLineAddress), amount, sendToAddress, toToken)
    )
  }

  pay(creditLineAddress, amount) {
    return this.submit(this.borrowerContract.methods.pay(this.getPoolAddressFromCL(creditLineAddress), amount))
  }

  payInFull(creditLineAddress, amount) {
    return this.submit(this.borrowerContract.methods.payInFull(this.getPoolAddressFromCL(creditLineAddress), amount))
  }

  payMultiple(creditLines, amounts) {
    let poolAddresses = creditLines.map((a) => this.getPoolAddressFromCL(a))
    return this.submit(this.borrowerContract.methods.payMultiple(poolAddresses, amounts))
  }

  payWithSwapOnOneInch(creditLineAddress, amount, minAmount, fromToken, quote) {
    return this.submit(
      this.borrowerContract.methods.payWithSwapOnOneInch(
        this.getPoolAddressFromCL(creditLineAddress),
        amount,
        fromToken,
        minAmount,
        quote.distribution
      )
    )
  }

  payMultipleWithSwapOnOneInch(creditLines, amounts, originAmount, fromToken, quote) {
    return this.submit(
      this.borrowerContract.methods.payMultipleWithSwapOnOneInch(
        creditLines.map((a) => this.getPoolAddressFromCL(a)),
        amounts,
        originAmount,
        fromToken,
        quote.distribution
      )
    )
  }

  async drawdownViaOneInchAsync(creditLineAddress, amount, sendToAddress, toToken) {
    toToken = toToken || "0xdac17f958d2ee523a2206206994597c13d831ec7" // Mainnet USDT
    const splitParts = 10

    const result = await this.oneInch.methods
      .getExpectedReturn(this.usdc.address, toToken, amount, splitParts, 0)
      .call(undefined, "latest")
    return this.borrowerContract.methods.drawdownWithSwapOnOneInch(
      this.getPoolAddressFromCL(creditLineAddress),
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

  submit(unsentAction) {
    if (this.shouldUseGasless) {
      // This needs to be a function, otherwise the initial Promise.resolve in useSendFromUser will try to
      // resolve (and therefore initialize the signing request) before updating the network widget
      return () => submitGaslessTransaction(this.borrowerAddress, unsentAction)
    } else {
      return unsentAction
    }
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
  let borrower: Contract | null = null
  if (borrowerCreatedEvents.length > 0) {
    const lastIndex = borrowerCreatedEvents.length - 1
    const lastEvent = borrowerCreatedEvents[lastIndex]
    if (lastEvent) {
      borrower = goldfinchProtocol.getContract<Contract>("Borrower", lastEvent.returnValues.borrower)
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
