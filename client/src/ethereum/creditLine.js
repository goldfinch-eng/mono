import web3 from '../web3';
import moment from 'moment';
import BigNumber from 'bignumber.js';
import * as CreditLineContract from '../../../artifacts/CreditLine.json';
import { fetchDataFromAttributes, USDC_DECIMALS, ETHDecimals, decimalPlaces, INTEREST_DECIMALS } from './utils';

function buildCreditLine(address) {
  return new web3.eth.Contract(CreditLineContract.abi, address);
}

async function fetchCreditLineData(creditLine) {
  let result = {};
  if (!creditLine) {
    return Promise.resolve({});
  }
  const attributes = [
    { method: 'balance' },
    { method: 'collectedPaymentBalance' },
    { method: 'interestApr' },
    { method: 'paymentPeriodInDays' },
    { method: 'termInDays' },
    { method: 'nextDueBlock' },
    { method: 'limit' },
    { method: 'interestOwed' },
    { method: 'termEndBlock' },
    { method: 'minCollateralPercent' },
  ];
  const data = await fetchDataFromAttributes(creditLine, attributes);
  result = { address: creditLine._address, ...data };
  result.dueDate = await calculateDueDateFromFutureBlock(result.nextDueBlock);
  result.termEndDate = await calculateDueDateFromFutureBlock(result.termEndBlock, 'MMM Do, YYYY');
  result.nextDueAmount = calculateNextDueAmount(result);
  result.interestAprDecimal = new BigNumber(result.interestApr).div(INTEREST_DECIMALS)
  result.availableBalance = result.limit - result.balance;
  return result;
}

async function calculateDueDateFromFutureBlock(nextDueBlock, format = 'MMM Do') {
  const latestBlock = await web3.eth.getBlock('latest');
  const numBlocksTillDueDate = nextDueBlock - latestBlock.number;
  return moment()
    .add(numBlocksTillDueDate * 15, 's')
    .format(format);
}

function calculateNextDueAmount(result) {
  const annualRate = new BigNumber(result.interestApr).dividedBy(new BigNumber(INTEREST_DECIMALS));
  const dailyRate = new BigNumber(annualRate).dividedBy(365.0);
  const periodRate = new BigNumber(dailyRate).multipliedBy(result.paymentPeriodInDays);
  const balance = new BigNumber(result.balance);
  const interestOwed = balance.multipliedBy(periodRate);
  if (new BigNumber(result.nextDueBlock).gte(new BigNumber(result.termEndBlock))) {
    return String(interestOwed.plus(balance).toFixed(decimalPlaces));
  } else {
    return String(interestOwed.toFixed(decimalPlaces));
  }
}

export { buildCreditLine, fetchCreditLineData };
