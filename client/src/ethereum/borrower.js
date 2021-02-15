import _ from 'lodash';
import web3 from '../web3';
import { submitGaslessTransaction } from '../ethereum/gassless';
import { getDeployments, getFromBlock } from './utils.js';
import BN from 'bn.js';

const BorrowerAbi = require('../../abi/Borrower.json');

class BorrowerInterface {
  constructor(userAddress, creditDesk, borrowerContract, usdc, pool) {
    this.userAddress = userAddress;
    this.creditDesk = creditDesk;
    this.borrowerContract = borrowerContract;
    this.usdc = usdc;
    this.pool = pool;
    this.borrowerAddress = this.isUsingBorrowerContract ? this.borrowerContract._address : this.userAddress;
    this.gasless = false;
  }

  async initialize() {
    this.creditLines = await this.creditDesk.methods.getBorrowerCreditLines(this.borrowerAddress).call();
    this.allowance = new BN(await this.usdc.methods.allowance(this.userAddress, this.pool._address).call());
  }

  get isUsingBorrowerContract() {
    return !!this.borrowerContract;
  }

  drawdown(creditLineAddress, drawdownAmount, sendToAddress) {
    if (this.isUsingBorrowerContract) {
      sendToAddress = sendToAddress || this.userAddress;
      return this.gaslessly(this.borrowerContract.methods.drawdown(creditLineAddress, drawdownAmount, sendToAddress));
    } else {
      if (sendToAddress) {
        throw new Error('SendToAddress not supported for non-borrower contracts');
      }
      return this.creditDesk.methods.drawdown(drawdownAmount, creditLineAddress);
    }
  }

  pay(creditLineAddress, amount) {
    if (this.isUsingBorrowerContract) {
      return this.gaslessly(this.borrowerContract.methods.pay(creditLineAddress, amount));
    } else {
      return this.creditDesk.methods.pay(creditLineAddress, amount);
    }
  }

  gaslessly(unsentAction) {
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
  const deployments = await getDeployments(networkId);
  if (borrowerCreatedEvents.length > 0) {
    borrower = new web3.eth.Contract(BorrowerAbi, borrowerCreatedEvents[0].returnValues.borrower);
  }
  const borrowerInterface = new BorrowerInterface(ownerAddress, creditDesk, borrower, usdc, pool);
  await borrowerInterface.initialize();
  return borrowerInterface;
}

export { getBorrowerContract };
