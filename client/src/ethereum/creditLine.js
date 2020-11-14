import web3 from '../web3';
import moment from 'moment';
import BigNumber from 'bignumber.js';
import * as CreditLineContract from '../../../artifacts/contracts/protocol/CreditLine.sol/CreditLine.json';
import { getUSDC } from './erc20';
import { fetchDataFromAttributes, INTEREST_DECIMALS } from './utils';

const zero = new BigNumber(0);
const defaultCreditLine = {
  balance: zero,
  limit: zero,
  periodDueAmount: zero,
  remainingPeriodDueAmount: zero,
  interestAprDecimal: zero,
  availableCredit: zero,
  collectedPaymentBalance: zero,
  totalDueAmount: zero,
  remainingTotalDueAmount: zero,
};

function buildCreditLine(address) {
  return new web3.eth.Contract(CreditLineContract.abi, address);
}

async function fetchCreditLineData(creditLine) {
  let result = {};
  if (!creditLine) {
    return Promise.resolve(defaultCreditLine);
  }
  const attributes = [
    { method: 'balance' },
    { method: 'interestApr' },
    { method: 'paymentPeriodInDays' },
    { method: 'termInDays' },
    { method: 'nextDueBlock' },
    { method: 'limit' },
    { method: 'interestOwed' },
    { method: 'termEndBlock' },
  ];
  let data = await fetchDataFromAttributes(creditLine, attributes);
  attributes.forEach(info => {
    data[info.method] = new BigNumber(data[info.method]);
  });
  // Considering we already got some data on the CreditLine, this next line
  // assumes we've cached the USDC contract, and do not need to pass in a network
  const usdc = await getUSDC();
  result = { address: creditLine._address, ...data };
  result.dueDate = await calculateDueDateFromFutureBlock(result.nextDueBlock);
  result.termEndDate = await calculateDueDateFromFutureBlock(result.termEndBlock, 'MMM Do, YYYY');
  result.collectedPaymentBalance = new BigNumber(await usdc.methods.balanceOf(creditLine._address).call());

  result.periodDueAmount = calculateNextDueAmount(result);
  result.remainingPeriodDueAmount = BigNumber.max(result.periodDueAmount.minus(result.collectedPaymentBalance), zero);

  // This is BigNumber, which is inconsistent with BN, but we need it because BigNumber handles decimals easily,
  // and the interestAPR needs to not just be an integer.
  result.interestAprDecimal = new BigNumber(result.interestApr).div(INTEREST_DECIMALS);
  result.availableCredit = result.limit.minus(result.balance);
  const interestOwed = calculateInteresOwed(result);
  result.totalDueAmount = interestOwed.plus(result.balance);
  result.remainingTotalDueAmount = BigNumber.max(result.totalDueAmount.minus(result.collectedPaymentBalance), zero);
  return result;
}

async function calculateDueDateFromFutureBlock(nextDueBlock, format = 'MMM Do') {
  const latestBlock = await web3.eth.getBlock('latest');
  const numBlocksTillDueDate = nextDueBlock - latestBlock.number;
  return moment()
    .add(numBlocksTillDueDate * 15, 's')
    .format(format);
}

function calculateInteresOwed(creditLine) {
  const annualRate = new BigNumber(creditLine.interestApr).dividedBy(new BigNumber(INTEREST_DECIMALS));
  const dailyRate = new BigNumber(annualRate).dividedBy(365.0);
  const periodRate = new BigNumber(dailyRate).multipliedBy(creditLine.paymentPeriodInDays);
  const balance = new BigNumber(creditLine.balance);
  return balance.multipliedBy(periodRate);
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

export { buildCreditLine, fetchCreditLineData, defaultCreditLine };
