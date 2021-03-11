import web3 from '../web3';
import { submitGaslessTransaction } from './gasless';
import { getFromBlock, ONE_INCH_ADDRESSES } from './utils.js';
import BigNumber from 'bignumber.js';
import { getOneInchContract } from './oneInch';

const BorrowerAbi = require('../../abi/Borrower.json');

class BorrowerInterface {
  constructor(userAddress, creditDesk, borrowerContract, usdc, pool, oneInch) {
    this.userAddress = userAddress;
    this.creditDesk = creditDesk;
    this.borrowerContract = borrowerContract;
    this.usdc = usdc;
    this.pool = pool;
    this.oneInch = oneInch;
    this.borrowerAddress = this.isUsingBorrowerContract ? this.borrowerContract._address : this.userAddress;
    this.gasless = this.isUsingBorrowerContract && process.env.REACT_APP_DISABLE_GASLESS !== 'true';
  }

  async initialize() {
    this.creditLines = await this.creditDesk.methods.getBorrowerCreditLines(this.borrowerAddress).call();
    this.allowance = new BigNumber(await this.usdc.methods.allowance(this.userAddress, this.borrowerAddress).call());
  }

  get isUsingBorrowerContract() {
    return !!this.borrowerContract;
  }

  drawdown(creditLineAddress, drawdownAmount, sendToAddress) {
    if (this.isUsingBorrowerContract) {
      sendToAddress = sendToAddress || this.userAddress;
      return this.submit(this.borrowerContract.methods.drawdown(creditLineAddress, drawdownAmount, sendToAddress));
    } else {
      if (sendToAddress) {
        throw new Error('SendToAddress not supported for non-borrower contracts');
      }
      return this.creditDesk.methods.drawdown(creditLineAddress, drawdownAmount);
    }
  }

  drawdownViaOneInch(creditLineAddress, amount, sendToAddress, toToken) {
    sendToAddress = sendToAddress || this.userAddress;
    return this.submit(this.drawdownViaOneInchAsync(creditLineAddress, amount, sendToAddress, toToken));
  }

  pay(creditLineAddress, amount) {
    if (this.isUsingBorrowerContract) {
      return this.submit(this.borrowerContract.methods.pay(creditLineAddress, amount));
    } else {
      return this.creditDesk.methods.pay(creditLineAddress, amount);
    }
  }

  payInFull(creditLineAddress, amount) {
    return this.submit(this.borrowerContract.methods.payInFull(creditLineAddress, amount));
  }

  payMultiple(creditLines, amounts) {
    return this.submit(this.borrowerContract.methods.payMultiple(creditLines, amounts));
  }

  payWithSwapOnOneInch(creditLineAddress, amount, fromToken) {
    return this.submit(this.payWithSwapOnOneInchAsync(creditLineAddress, amount, fromToken));
  }

  async drawdownViaOneInchAsync(creditLineAddress, amount, sendToAddress, toToken) {
    toToken = toToken || '0xdac17f958d2ee523a2206206994597c13d831ec7'; // Mainnet USDT
    const splitParts = 10;

    const result = await this.oneInch.methods
      .getExpectedReturn(this.usdc._address, toToken, amount, splitParts, 0)
      .call();
    return this.borrowerContract.methods.drawdownWithSwapOnOneInch(
      creditLineAddress,
      amount,
      sendToAddress,
      toToken,
      this.withinOnePercent(result.returnAmount),
      result.distribution,
    );
  }

  async payWithSwapOnOneInchAsync(creditLineAddress, amount, fromToken) {
    fromToken = fromToken || '0xdac17f958d2ee523a2206206994597c13d831ec7'; // Mainnet USDT
    const splitParts = 10;
    // TODO: Ensure amount has correct number of decimal places (USDT is 18)
    const result = await this.oneInch.methods
      .getExpectedReturn(fromToken, this.usdc._address, amount, splitParts, 0)
      .call();
    return this.borrowerContract.methods.payWithSwapOnOneInch(
      creditLineAddress,
      amount,
      fromToken,
      this.withinOnePercent(result.returnAmount),
      result.distribution,
    );
  }

  withinOnePercent(amount) {
    return new BigNumber(amount)
      .times(new BigNumber(99))
      .idiv(new BigNumber(100))
      .toString();
  }

  submit(unsentAction) {
    if (this.gasless) {
      if (!this.isUsingBorrowerContract) {
        throw new Error('Gasless transactions are only supported for borrower contracts');
      }
      // This needs to be a function, otherwise the initial Promise.resolve in useSendFromUser will try to
      // resolve (and therefore initialize the signing request) before updating the network widget
      return () => submitGaslessTransaction(this.borrowerAddress, unsentAction);
    } else {
      return unsentAction;
    }
  }
}

async function getBorrowerContract(ownerAddress, creditLineFactory, creditDesk, usdc, pool, networkId) {
  const borrowerCreatedEvents = await creditLineFactory.getPastEvents('BorrowerCreated', {
    filter: { owner: ownerAddress },
    fromBlock: getFromBlock(creditLineFactory.chain),
    to: 'latest',
  });
  let borrower;
  if (borrowerCreatedEvents.length > 0) {
    const lastIndex = borrowerCreatedEvents.length - 1;
    borrower = new web3.eth.Contract(BorrowerAbi, borrowerCreatedEvents[lastIndex].returnValues.borrower);
  }
  const oneInch = getOneInchContract(networkId);
  const borrowerInterface = new BorrowerInterface(ownerAddress, creditDesk, borrower, usdc, pool, oneInch);
  await borrowerInterface.initialize();
  return borrowerInterface;
}

export { getBorrowerContract };
