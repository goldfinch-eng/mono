import BigNumber from 'bignumber.js';
import { usdcFromAtomic } from './erc20.js';
import _ from 'lodash';

const EVENT_TYPE_MAP = {
  DepositMade: 'Deposit',
  WithdrawalMade: 'Withdrawal',
  DrawdownMade: 'Drawdown',
  PaymentCollected: 'Payment',
};

const EVENT_AMOUNT_FIELD = {
  WithdrawalMade: 'userAmount',
  DepositMade: 'amount',
  DrawdownMade: 'drawdownAmount',
  PaymentCollected: 'paymentAmount',
};

async function getUserData(address, erc20, pool, creditDesk) {
  let usdcBalance = new BigNumber(0);
  let allowance = new BigNumber(0);
  if (erc20) {
    usdcBalance = await erc20.methods.balanceOf(address).call();
  }
  if (pool && erc20) {
    allowance = new BigNumber(await erc20.methods.allowance(address, pool._address).call());
  }
  const [poolTxs, creditDeskTxs] = await Promise.all([
    getAndTransformPoolEvents(pool, address),
    getAndTransformCreditDeskEvents(creditDesk, address),
  ]);
  const allTxs = _.sortBy(_.compact(_.concat(poolTxs, creditDeskTxs)), 'blockNumber');

  const data = {
    address: address,
    usdcBalance: usdcFromAtomic(usdcBalance),
    allowance: allowance,
    pastTxs: allTxs,
  };
  return data;
}

async function getAndTransformPoolEvents(pool, address) {
  const [depositEvents, withdrawalEvents] = await Promise.all(
    ['DepositMade', 'WithdrawalMade'].map(eventName => {
      return pool.getPastEvents(eventName, {
        filter: { capitalProvider: address },
        fromBlock: 'earliest',
        to: 'latest',
      });
    }),
  );
  const poolEvents = _.compact(_.concat(depositEvents, withdrawalEvents));
  return mapEventsToTx(poolEvents);
}

async function getAndTransformCreditDeskEvents(creditDesk, address) {
  const [paymentEvents, drawdownEvents] = await Promise.all(
    ['PaymentCollected', 'DrawdownMade'].map(eventName => {
      return creditDesk.getPastEvents(eventName, {
        filter: { payer: address, borrower: address },
        fromBlock: 'earliest',
        to: 'latest',
      });
    }),
  );
  const creditDeskEvents = _.compact(_.concat(paymentEvents, drawdownEvents));
  return mapEventsToTx(creditDeskEvents);
}

function mapEventsToTx(events) {
  return _.map(events, mapEventToTx);
}

function mapEventToTx(event) {
  return {
    type: EVENT_TYPE_MAP[event.event],
    amount: usdcFromAtomic(event.returnValues[EVENT_AMOUNT_FIELD[event.event]]),
    id: event.id,
    transactionHash: event.transactionHash,
    blockNumber: event.blockNumber,
    status: 'successful',
  };
}

export { getUserData };
