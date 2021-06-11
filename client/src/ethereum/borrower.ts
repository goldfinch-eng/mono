import { submitGaslessTransaction } from "./gasless"
import BigNumber from "bignumber.js"
import { getOneInchContract } from "./oneInch"
import { Contract } from "web3-eth-contract"
import { ERC20, Tickers } from "./erc20"
import { GoldfinchProtocol } from "./GoldfinchProtocol"
import { GoldfinchFactory } from "../typechain/web3/GoldfinchFactory"
import { TranchedPool } from "./tranchedPool"

class BorrowerInterface {
  userAddress: string
  borrowerContract: Contract
  usdc: ERC20
  goldfinchProtocol: GoldfinchProtocol
  oneInch: Contract
  borrowerAddress: string
  creditLinesAddresses!: string[]
  borrowerPoolAddresses!: string[]
  tranchedPools!: { [address: string]: TranchedPool }
  tranchedPoolByCreditLine!: { [address: string]: TranchedPool }
  allowance!: BigNumber

  constructor(userAddress, borrowerContract, goldfinchProtocol: GoldfinchProtocol, oneInch) {
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

  async initialize() {
    let poolEvents = await this.goldfinchProtocol.queryEvents("GoldfinchFactory", ["PoolCreated"], {
      borrower: this.borrowerAddress,
    })
    this.borrowerPoolAddresses = poolEvents.map((e: any) => e.returnValues.pool)
    for (let address of this.borrowerPoolAddresses) {
      const tranchedPool = new TranchedPool(address, this.goldfinchProtocol)
      await tranchedPool.initialize()
      this.creditLinesAddresses.push(tranchedPool.creditLineAddress)
      this.tranchedPoolByCreditLine[tranchedPool.creditLineAddress] = tranchedPool
      this.tranchedPools[address] = tranchedPool
    }
    this.allowance = await this.usdc.getAllowance({ owner: this.userAddress, spender: this.borrowerAddress })
  }

  getPoolAddressFromCL(address: string): string {
    return this.tranchedPoolByCreditLine[address].address
  }

  get shouldUseGasless() {
    return process.env.REACT_APP_DISABLE_GASLESS !== "true" && (window as any).disableGasless !== true
  }

  drawdown(creditLineAddress, drawdownAmount, sendToAddress) {
    sendToAddress = sendToAddress || this.userAddress
    return this.submit(
      this.borrowerContract.methods.drawdown(
        this.getPoolAddressFromCL(creditLineAddress),
        drawdownAmount,
        sendToAddress,
      ),
    )
  }

  drawdownViaOneInch(creditLineAddress, amount, sendToAddress, toToken) {
    sendToAddress = sendToAddress || this.userAddress
    return this.submit(
      this.drawdownViaOneInchAsync(this.getPoolAddressFromCL(creditLineAddress), amount, sendToAddress, toToken),
    )
  }

  pay(creditLineAddress, amount) {
    return this.submit(this.borrowerContract.methods.pay(this.getPoolAddressFromCL(creditLineAddress), amount))
  }

  payInFull(creditLineAddress, amount) {
    return this.submit(this.borrowerContract.methods.payInFull(this.getPoolAddressFromCL(creditLineAddress), amount))
  }

  payMultiple(creditLines, amounts) {
    let poolAddresses = creditLines.map(a => this.getPoolAddressFromCL(a))
    return this.submit(this.borrowerContract.methods.payMultiple(poolAddresses, amounts))
  }

  payWithSwapOnOneInch(creditLineAddress, amount, minAmount, fromToken, quote) {
    return this.submit(
      this.borrowerContract.methods.payWithSwapOnOneInch(
        this.getPoolAddressFromCL(creditLineAddress),
        amount,
        fromToken,
        minAmount,
        quote.distribution,
      ),
    )
  }

  payMultipleWithSwapOnOneInch(creditLines, amounts, originAmount, fromToken, quote) {
    return this.submit(
      this.borrowerContract.methods.payMultipleWithSwapOnOneInch(
        creditLines.map(a => this.getPoolAddressFromCL(a)),
        amounts,
        originAmount,
        fromToken,
        quote.distribution,
      ),
    )
  }

  async drawdownViaOneInchAsync(creditLineAddress, amount, sendToAddress, toToken) {
    toToken = toToken || "0xdac17f958d2ee523a2206206994597c13d831ec7" // Mainnet USDT
    const splitParts = 10

    const result = await this.oneInch.methods
      .getExpectedReturn(this.usdc.address, toToken, amount, splitParts, 0)
      .call()
    return this.borrowerContract.methods.drawdownWithSwapOnOneInch(
      this.getPoolAddressFromCL(creditLineAddress),
      amount,
      sendToAddress,
      toToken,
      this.withinOnePercent(result.returnAmount),
      result.distribution,
    )
  }

  withinOnePercent(amount): string {
    return new BigNumber(amount)
      .times(new BigNumber(99))
      .idiv(new BigNumber(100))
      .toString()
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

async function getBorrowerContract(ownerAddress, goldfinchProtocol) {
  const borrowerCreatedEvents = await goldfinchProtocol.queryEvents("GoldfinchFactory", "BorrowerCreated", {
    owner: ownerAddress,
  })
  let borrower
  if (borrowerCreatedEvents.length > 0) {
    const lastIndex = borrowerCreatedEvents.length - 1
    borrower = goldfinchProtocol.getContract("Borrower", borrowerCreatedEvents[lastIndex].returnValues.borrower)
  }
  const oneInch = getOneInchContract(goldfinchProtocol.networkId)
  const borrowerInterface = new BorrowerInterface(ownerAddress, borrower, goldfinchProtocol, oneInch)
  await borrowerInterface.initialize()
  return borrowerInterface
}

export { getBorrowerContract, BorrowerInterface }
