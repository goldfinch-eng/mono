import web3 from '../web3';
import moment from 'moment';
import BigNumber from 'bignumber.js';
import { getUSDC, usdcFromAtomic } from './erc20';
import { fetchDataFromAttributes, INTEREST_DECIMALS, BLOCKS_PER_YEAR, BLOCKS_PER_DAY, getDeployments } from './utils';
import { roundUpPenny, roundDownPenny } from '../utils';

const CreditLineAbi = require('../../abi/Creditline.json');

const zero = new BigNumber(0);
const defaultCreditLine = {
  balance: zero,
  limit: zero,
  periodDueAmount: zero,
  remainingPeriodDueAmount: zero,
  remainingPeriodDueAmountInDollars: zero,
  interestAprDecimal: zero,
  availableCredit: zero,
  availableCreditInDollars: zero,
  collectedPaymentBalance: zero,
  totalDueAmount: zero,
  remainingTotalDueAmount: zero,
  remainingTotalDueAmountInDollars: zero,
  isLate: false,
  loaded: false,
};

function buildCreditLine(address) {
  return new web3.eth.Contract(CreditLineAbi, address);
}

async function fetchCreditLineData(creditLine, usdcContract) {
  let result = {};
  if (!creditLine) {
    return Promise.resolve(defaultCreditLine);
  }
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
  let data = await fetchDataFromAttributes(creditLine, attributes);
  attributes.forEach(info => {
    data[info.method] = new BigNumber(data[info.method]);
  });
  result = { address: creditLine._address, ...data };
  const interestOwed = calculateInteresOwed(result);
  result.dueDate = await calculateDueDateFromFutureBlock(result.nextDueBlock);
  result.termEndDate = await calculateDueDateFromFutureBlock(result.termEndBlock, 'MMM D, YYYY');
  result.collectedPaymentBalance = new BigNumber(await usdcContract.methods.balanceOf(result.address).call());
  result.periodDueAmount = calculateNextDueAmount(result);
  result.remainingPeriodDueAmount = BigNumber.max(result.periodDueAmount.minus(result.collectedPaymentBalance), zero);
  result.remainingPeriodDueAmountInDollars = new BigNumber(
    roundUpPenny(usdcFromAtomic(result.remainingPeriodDueAmount)),
  );
  result.interestAprDecimal = new BigNumber(result.interestApr).div(INTEREST_DECIMALS);
  result.totalDueAmount = interestOwed.plus(result.balance);
  result.remainingTotalDueAmount = BigNumber.max(result.totalDueAmount.minus(result.collectedPaymentBalance), zero);
  result.remainingTotalDueAmountInDollars = new BigNumber(roundUpPenny(usdcFromAtomic(result.remainingTotalDueAmount)));
  const collectedForPrincipal = BigNumber.max(result.collectedPaymentBalance.minus(result.periodDueAmount), zero);
  result.availableCredit = BigNumber.min(result.limit, result.limit.minus(result.balance).plus(collectedForPrincipal));
  result.availableCreditInDollars = new BigNumber(roundDownPenny(usdcFromAtomic(result.availableCredit)));
  result.isLate = await calculateIsLate(result);
  // Just for front-end usage.
  result.loaded = true;
  return result;
}

async function calculateDueDateFromFutureBlock(nextDueBlock, format = 'MMM D') {
  const latestBlock = await web3.eth.getBlock('latest');
  const numBlocksTillDueDate = nextDueBlock - latestBlock.number;
  return moment()
    .add(numBlocksTillDueDate * 15, 's')
    .format(format);
}

function calculateInteresOwed(creditLine) {
  const currentInterestOwed = creditLine.interestOwed;
  const annualRate = creditLine.interestApr.dividedBy(new BigNumber(INTEREST_DECIMALS));
  const expectedElapsedBlocks = creditLine.nextDueBlock.minus(creditLine.interestAccruedAsOfBlock);
  const blockRate = annualRate.dividedBy(BLOCKS_PER_YEAR);
  const balance = creditLine.balance;
  const expectedAdditionalInterest = balance.multipliedBy(blockRate).multipliedBy(expectedElapsedBlocks);
  return currentInterestOwed.plus(expectedAdditionalInterest);
}

function calculateNextDueAmount(creditLine) {
  const interestOwed = calculateInteresOwed(creditLine);
  const balance = creditLine.balance;
  if (creditLine.nextDueBlock.gte(creditLine.termEndBlock)) {
    return interestOwed.plus(balance);
  } else {
    return interestOwed;
  }
}

async function calculateIsLate(creditLine) {
  const latestBlock = await web3.eth.getBlock('latest');
  if (creditLine.lastFullPaymentBlock.isZero()) {
    // Brand new creditline
    return false;
  }
  const blocksElapsedSinceLastFullPayment = latestBlock.number - creditLine.lastFullPaymentBlock;
  return blocksElapsedSinceLastFullPayment > creditLine.paymentPeriodInDays * BLOCKS_PER_DAY;
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

export { buildCreditLine, fetchCreditLineData, getCreditLineFactory, defaultCreditLine };
