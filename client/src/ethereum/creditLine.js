import web3 from '../web3';
import moment from 'moment';
import BigNumber from 'bignumber.js';
import * as CreditLineContract from '../../../artifacts/CreditLine.json';
import { fetchDataFromAttributes, decimalPlaces } from './utils';

function buildCreditLine(address) {
  return new web3.eth.Contract(CreditLineContract.abi, address);
}

async function fetchCreditLineData(creditLine) {
  console.log('Trying to fetch credit line data with...', creditLine);
  let result = {};
  if (!creditLine) {
    return Promise.resolve({});
  }
  const attributes = [
    { method: 'balance' },
    { method: 'prepaymentBalance' },
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
  result.interestAprDecimal = ((result.interestApr * 10) / 10e18) * 10 ** decimalPlaces;
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
  console.log('Result is...', result);
  // balance, interestApr, termInDays, paymentPeriodInDays
  // `balance * (periodRate / (1 - (1 / ((1 + periodRate) ^ periods_per_term))))`
  /*
    int128 annualRate = FPMath.divi(int256(interestApr), int256(interestDecimals));
    int128 dailyRate = FPMath.div(annualRate, FPMath.fromInt(int256(365)));
    int128 periodRate = FPMath.mul(dailyRate, FPMath.fromInt(int256(paymentPeriodInDays)));
    int128 termRate = FPMath.pow(FPMath.add(one, periodRate), periodsPerTerm);

    int128 denominator = FPMath.sub(one, FPMath.div(one, termRate));
    if (denominator == 0) {
      return balance / periodsPerTerm;
    }
    int128 paymentFractionFP = FPMath.div(periodRate, denominator);
    uint paymentFraction = uint(FPMath.muli(paymentFractionFP, int256(1e18)));

    return (balance * paymentFraction) / 1e18;
  */
  const periodsPerTerm = new BigNumber(result.termInDays).dividedBy(result.paymentPeriodInDays);
  const annualRate = new BigNumber(result.interestApr).dividedBy(new BigNumber(1e18));
  const dailyRate = new BigNumber(annualRate).dividedBy(365.0);
  const periodRate = new BigNumber(dailyRate).multipliedBy(result.paymentPeriodInDays);
  const termRate = new BigNumber(1).plus(periodRate).pow(periodsPerTerm);
  const denominator = new BigNumber(1).minus(new BigNumber(1).dividedBy(termRate));
  const balance = new BigNumber(result.balance);
  if (denominator.eq(0)) {
    return String(balance.dividedBy(periodsPerTerm));
  }
  const paymentFraction = new BigNumber(periodRate).dividedBy(denominator);
  return String(balance.multipliedBy(paymentFraction).toFixed(decimalPlaces));
}

export { buildCreditLine, fetchCreditLineData };
