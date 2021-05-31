import web3 from "../web3"
import { submitGaslessTransaction } from "./gasless"
import { getFromBlock } from "./utils"
import BigNumber from "bignumber.js"
import { getOneInchContract } from "./oneInch"
import {Contract} from 'web3-eth-contract'
import {ERC20} from './erc20'

const BorrowerAbi = require("../../abi/Borrower.json")

class BorrowerInterface {
  userAddress: string
  creditDesk: Contract
  borrowerContract: Contract
  usdc: ERC20
  pool: Contract
  oneInch: Contract
  borrowerAddress: string
  creditLinesAddresses!: string[]
  allowance!: BigNumber
  
  constructor(userAddress, creditDesk, borrowerContract, usdc, pool, oneInch) {
    this.userAddress = userAddress
    this.creditDesk = creditDesk
    this.borrowerContract = borrowerContract
    this.usdc = usdc
    this.pool = pool
    this.oneInch = oneInch
    this.borrowerAddress = this.isUsingBorrowerContract ? this.borrowerContract.options.address : this.userAddress
  }

  async initialize() {
    this.creditLinesAddresses = await this.creditDesk.methods.getBorrowerCreditLines(this.borrowerAddress).call()
    this.allowance = await this.usdc.getAllowance({ owner: this.userAddress, spender: this.borrowerAddress })
  }

  get shouldUseGasless() {
    const gaslessEnabled = process.env.REACT_APP_DISABLE_GASLESS !== "true" && (window as any).disableGasless !== true
    return this.isUsingBorrowerContract && gaslessEnabled
  }

  get isUsingBorrowerContract() {
    return !!this.borrowerContract
  }

  drawdown(creditLineAddress, drawdownAmount, sendToAddress) {
    if (this.isUsingBorrowerContract) {
      sendToAddress = sendToAddress || this.userAddress
      return this.submit(this.borrowerContract.methods.drawdown(creditLineAddress, drawdownAmount, sendToAddress))
    } else {
      if (sendToAddress) {
        throw new Error("SendToAddress not supported for non-borrower contracts")
      }
      return this.creditDesk.methods.drawdown(creditLineAddress, drawdownAmount)
    }
  }

  drawdownViaOneInch(creditLineAddress, amount, sendToAddress, toToken) {
    sendToAddress = sendToAddress || this.userAddress
    return this.submit(this.drawdownViaOneInchAsync(creditLineAddress, amount, sendToAddress, toToken))
  }

  pay(creditLineAddress, amount) {
    if (this.isUsingBorrowerContract) {
      return this.submit(this.borrowerContract.methods.pay(creditLineAddress, amount))
    } else {
      return this.creditDesk.methods.pay(creditLineAddress, amount)
    }
  }

  payInFull(creditLineAddress, amount) {
    return this.submit(this.borrowerContract.methods.payInFull(creditLineAddress, amount))
  }

  payMultiple(creditLines, amounts) {
    return this.submit(this.borrowerContract.methods.payMultiple(creditLines, amounts))
  }

  payWithSwapOnOneInch(creditLineAddress, amount, minAmount, fromToken, quote) {
    return this.submit(
      this.borrowerContract.methods.payWithSwapOnOneInch(
        creditLineAddress,
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
        creditLines,
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
      creditLineAddress,
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
      if (!this.isUsingBorrowerContract) {
        throw new Error("Gasless transactions are only supported for borrower contracts")
      }
      // This needs to be a function, otherwise the initial Promise.resolve in useSendFromUser will try to
      // resolve (and therefore initialize the signing request) before updating the network widget
      return () => submitGaslessTransaction(this.borrowerAddress, unsentAction)
    } else {
      return unsentAction
    }
  }
}

async function getBorrowerContract(ownerAddress, goldfinchFactory, creditDesk, usdc, pool, networkId) {
  const borrowerCreatedEvents = await goldfinchFactory.getPastEvents("BorrowerCreated", {
    filter: { owner: ownerAddress },
    fromBlock: getFromBlock(goldfinchFactory.chain),
    to: "latest",
  })
  let borrower
  if (borrowerCreatedEvents.length > 0) {
    const lastIndex = borrowerCreatedEvents.length - 1
    borrower = new web3.eth.Contract(BorrowerAbi, borrowerCreatedEvents[lastIndex].returnValues.borrower)
  }
  const oneInch = getOneInchContract(networkId)
  const borrowerInterface = new BorrowerInterface(ownerAddress, creditDesk, borrower, usdc, pool, oneInch)
  await borrowerInterface.initialize()
  return borrowerInterface
}

export { getBorrowerContract, BorrowerInterface }
