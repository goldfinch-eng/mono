import web3 from '../web3';
import { submitGaslessTransaction } from '../ethereum/gassless';
import { getDeployments, getFromBlock, ONE_INCH_ADDRESSES } from './utils.js';
import BigNumber from 'bignumber.js';

const BorrowerAbi = require('../../abi/Borrower.json');
const OneInchAbi = require('../../abi/OneSplit.json');

class BorrowerInterface {
  constructor(userAddress, creditDesk, borrowerContract, usdc, pool, oneInch) {
    this.userAddress = userAddress;
    this.creditDesk = creditDesk;
    this.borrowerContract = borrowerContract;
    this.usdc = usdc;
    this.pool = pool;
    this.oneInch = oneInch;
    this.borrowerAddress = this.isUsingBorrowerContract ? this.borrowerContract._address : this.userAddress;
    this.gasless = false;
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

  drawdownViaOneInch(creditLineAddress, amount, sendToAddress, toToken) {
    toToken = toToken || '0xdac17f958d2ee523a2206206994597c13d831ec7'; // Mainnet USDT
    const splitParts = 10;
    // const result = await this.oneInch.methods.getExpectedReturn(this.usdc._address, toToken, amount, splitParts, 0).call();
    // console.log(`${result.returnAmount}. split: ${result.distribution}`);
    // Sample drawdown for 500$
    return this.borrowerContract.methods.drawdownWithSwapOnOneInch(
      creditLineAddress,
      amount,
      sendToAddress,
      toToken,
      '500482468',
      ['0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '10', '0', '0', '0', '0', '0', '0'],
      // result.returnAmount,
      // result.distribution,
    );
  }

  submit(unsentAction) {
    if (this.gasless) {
      if (!this.isUsingBorrowerContract) {
        throw new Error('Gasless transactions are only supported for borrower contracts');
      }
      return submitGaslessTransaction(this.borrowerAddress, unsentAction.encodeABI());
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
    borrower = new web3.eth.Contract(BorrowerAbi, borrowerCreatedEvents[0].returnValues.borrower);
  }
  const oneInch = new web3.eth.Contract(OneInchAbi, ONE_INCH_ADDRESSES[networkId]);
  const borrowerInterface = new BorrowerInterface(ownerAddress, creditDesk, borrower, usdc, pool, oneInch);
  await borrowerInterface.initialize();
  return borrowerInterface;
}

export { getBorrowerContract };
