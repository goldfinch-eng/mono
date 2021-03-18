import web3 from '../web3';
import moment from 'moment';
import BigNumber from 'bignumber.js';
import { usdcFromAtomic, usdcToAtomic } from './erc20';
import { fetchDataFromAttributes, INTEREST_DECIMALS, BLOCKS_PER_YEAR, BLOCKS_PER_DAY, getDeployments } from './utils';
import { roundUpPenny, roundDownPenny, croppedAddress, displayDollars } from '../utils';

const CreditLineAbi = require('../../abi/Creditline.json');

const zero = new BigNumber(0);

class BaseCreditLine {
  async initialize() {
    // no-op
  }

  async _calculateDueDateFromFutureBlock(nextDueBlock, format = 'MMM D') {
    const latestBlock = await web3.eth.getBlock('latest');
    const numBlocksTillDueDate = nextDueBlock - latestBlock.number;
    return moment()
      .add(numBlocksTillDueDate * 15, 's')
      .format(format);
  }

  get remainingPeriodDueAmountInDollars() {
    return this.inDollars(this.remainingPeriodDueAmount);
  }

  get remainingTotalDueAmountInDollars() {
    return this.inDollars(this.remainingTotalDueAmount);
  }

  get availableCreditInDollars() {
    return this.inDollars(this.availableCredit);
  }

  get isMultiple() {
    return this.creditLines.length > 1;
  }

  // Is next payment due
  get isPaymentDue() {
    return this.remainingPeriodDueAmount.gt(0);
  }

  // Has an open balance
  get isActive() {
    return this.limit.gt(0) && this.remainingTotalDueAmount.gt(0);
  }

  inDollars(amount) {
    return new BigNumber(roundUpPenny(usdcFromAtomic(amount)));
  }
}

class DefaultCreditLine extends BaseCreditLine {
  constructor() {
    super();
    this.balance = zero;
    this.balance = zero;
    this.limit = zero;
    this.periodDueAmount = zero;
    this.remainingPeriodDueAmount = zero;
    this.interestAprDecimal = zero;
    this.availableCredit = zero;
    this.collectedPaymentBalance = zero;
    this.totalDueAmount = zero;
    this.remainingTotalDueAmount = zero;
    this.isLate = false;
    this.loaded = false;
    this.creditLines = [];
    this.name = 'No Credit Lines';
  }
}

class CreditLine extends BaseCreditLine {
  constructor(address, usdc) {
    super();
    this.address = address;
    this.creditLine = new web3.eth.Contract(CreditLineAbi, address);
    this.isLate = false;
    this.loaded = false;
    this.creditLines = [this];
    this.name = croppedAddress(this.address);
    this.usdc = usdc;
  }

  async initialize() {
    const attributes = [
      { method: 'balance' },
      { method: 'interestApr' },
      { method: 'interestAccruedAsOfBlock' },
      { method: 'paymentPeriodInDays' },
      { method: 'termInDays' },
      { method: 'nextDueBlock' },
      { method: 'limit' },
      { method: 'interestOwed' },
      { method: 'termEndBlock' },
      { method: 'lastFullPaymentBlock' },
    ];
    let data = await fetchDataFromAttributes(this.creditLine, attributes);
    attributes.forEach(info => {
      this[info.method] = new BigNumber(data[info.method]);
    });

    const interestOwed = this._calculateInterestOwed();
    this.dueDate = await this._calculateDueDateFromFutureBlock(this.nextDueBlock);
    this.termEndDate = await this._calculateDueDateFromFutureBlock(this.termEndBlock, 'MMM D, YYYY');
    this.collectedPaymentBalance = new BigNumber(await this.usdc.methods.balanceOf(this.address).call());
    this.periodDueAmount = this._calculateNextDueAmount();
    this.remainingPeriodDueAmount = BigNumber.max(this.periodDueAmount.minus(this.collectedPaymentBalance), zero);
    this.interestAprDecimal = new BigNumber(this.interestApr).div(INTEREST_DECIMALS);
    this.totalDueAmount = interestOwed.plus(this.balance);
    this.remainingTotalDueAmount = BigNumber.max(this.totalDueAmount.minus(this.collectedPaymentBalance), zero);
    const collectedForPrincipal = BigNumber.max(this.collectedPaymentBalance.minus(this.periodDueAmount), zero);
    this.availableCredit = BigNumber.min(this.limit, this.limit.minus(this.balance).plus(collectedForPrincipal));
    this.isLate = await this._calculateIsLate();
    // Just for front-end usage.
    this.loaded = true;
  }

  async _calculateIsLate() {
    const latestBlock = await web3.eth.getBlock('latest');
    if (this.lastFullPaymentBlock.isZero()) {
      // Brand new creditline
      return false;
    }
    const blocksElapsedSinceLastFullPayment = latestBlock.number - this.lastFullPaymentBlock;
    return blocksElapsedSinceLastFullPayment > this.paymentPeriodInDays * BLOCKS_PER_DAY;
  }

  _calculateInterestOwed() {
    const currentInterestOwed = this.interestOwed;
    const annualRate = this.interestApr.dividedBy(new BigNumber(INTEREST_DECIMALS));
    const expectedElapsedBlocks = this.nextDueBlock.minus(this.interestAccruedAsOfBlock);
    const blockRate = annualRate.dividedBy(BLOCKS_PER_YEAR);
    const balance = this.balance;
    const expectedAdditionalInterest = balance.multipliedBy(blockRate).multipliedBy(expectedElapsedBlocks);
    return currentInterestOwed.plus(expectedAdditionalInterest);
  }

  _calculateNextDueAmount() {
    const interestOwed = this._calculateInterestOwed();
    const balance = this.balance;
    if (this.nextDueBlock.gte(this.termEndBlock)) {
      return interestOwed.plus(balance);
    } else {
      return interestOwed;
    }
  }
}

class MultipleCreditLines extends BaseCreditLine {
  constructor(addresses, usdc) {
    super();
    this.address = addresses;
    this.creditLines = [];
    this.isLate = false;
    this.loaded = false;
    this.name = 'All';
    this.usdc = usdc;
  }

  async initialize() {
    this.creditLines = this.address.map(address => new CreditLine(address, this.usdc));
    await Promise.all(this.creditLines.map(cl => cl.initialize()));
    // Filter by active and sort by most recent
    this.creditLines = this.creditLines.filter(cl => cl.limit.gt(0)).reverse();
    // Reset address to match creditlines
    this.address = this.creditLines.map(cl => cl.address);

    // Picks the minimum due date
    this.dueDate = await this._calculateDueDateFromFutureBlock(this.nextDueBlock);
  }

  splitPayment(dollarAmountAtomic) {
    // Pay the minimum amounts for each creditline until there's no money left
    let amountRemaining = new BigNumber(usdcToAtomic(dollarAmountAtomic));
    let addresses = [];
    let amounts = [];
    const creditLinesByEarliestDue = this.creditLines
      .slice(0)
      .sort((cl1, cl2) => cl1.nextDueBlock.minus(cl2.nextDueBlock).toNumber());
    creditLinesByEarliestDue.forEach(cl => {
      const dueAmount = new BigNumber(usdcToAtomic(cl.remainingPeriodDueAmountInDollars));
      if (amountRemaining.lte(0) || dueAmount.lte(0)) {
        // If we've run out of money, or this credit line has no payment due, skip
        return;
      }
      let amountToPay = dueAmount;
      if (amountRemaining.gt(amountToPay)) {
        // We have more money than what's due
        addresses.push(cl.address);
        amounts.push(amountToPay);
        amountRemaining = amountRemaining.minus(amountToPay);
      } else {
        // If the remaining amount is not sufficient to cover the minimumDue, just use whatever is left
        addresses.push(cl.address);
        amounts.push(amountRemaining);
        amountRemaining = zero;
      }
    });
    console.log(`Split ${dollarAmountAtomic} into ${amounts} for ${addresses}`);
    return [addresses, amounts];
  }

  get availableCredit() {
    return this.creditLines.reduce((val, cl) => val.plus(cl.availableCredit), zero);
  }

  get limit() {
    return this.creditLines.reduce((val, cl) => val.plus(cl.limit), zero);
  }

  get remainingPeriodDueAmount() {
    return this.creditLines.reduce((val, cl) => val.plus(cl.remainingPeriodDueAmount), zero);
  }

  get remainingTotalDueAmount() {
    return this.creditLines.reduce((val, cl) => val.plus(cl.remainingTotalDueAmount), zero);
  }

  get nextDueBlock() {
    return this.creditLines.reduce(
      (val, cl) => BigNumber.minimum(val, cl.nextDueBlock),
      this.creditLines[0].nextDueBlock,
    );
  }
}

function buildCreditLine(address) {
  return new web3.eth.Contract(CreditLineAbi, address);
}

async function fetchCreditLineData(creditLineAddresses, usdc) {
  let result;
  // Provided address can be a nothing, a single address or an array of addresses. Normalize the single address to an array
  creditLineAddresses = typeof creditLineAddresses === 'string' ? [creditLineAddresses] : creditLineAddresses;

  if (!creditLineAddresses || creditLineAddresses.length === 0) {
    return Promise.resolve(new DefaultCreditLine());
  }
  if (creditLineAddresses.length === 1) {
    result = new CreditLine(creditLineAddresses[0], usdc.contract);
  } else {
    result = new MultipleCreditLines(creditLineAddresses, usdc.contract);
  }
  await result.initialize();
  return result;
}

async function getCreditLineFactory(networkId) {
  const deployments = await getDeployments(networkId);
  const creditLineFactoryAddress = deployments.contracts.CreditLineFactory.address;
  const creditLineFactory = new web3.eth.Contract(
    deployments.contracts.CreditLineFactory.abi,
    creditLineFactoryAddress,
  );
  return creditLineFactory;
}

const defaultCreditLine = new DefaultCreditLine();

export { buildCreditLine, fetchCreditLineData, getCreditLineFactory, defaultCreditLine };
