import BigNumber from 'bignumber.js';
import { usdcFromAtomic } from './erc20.js';
import _ from 'lodash';
import web3 from '../web3.js';
import moment from 'moment';

const EVENT_TYPE_MAP = {
  DepositMade: 'Deposit',
  WithdrawalMade: 'Withdrawal',
  DrawdownMade: 'Borrow',
  PaymentCollected: 'Payment',
  Approval: 'Approval',
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
    usdcBalance = new BigNumber(await erc20.methods.balanceOf(address).call());
  }
  if (pool && erc20) {
    allowance = new BigNumber(await erc20.methods.allowance(address, pool._address).call());
  }
  const [erc20Txs, poolTxs, creditDeskTxs] = await Promise.all([
    getAndTransformERC20Events(erc20, pool.address, address),
    getAndTransformPoolEvents(pool, address),
    getAndTransformCreditDeskEvents(creditDesk, address),
  ]);
  const allTxs = _.reverse(_.sortBy(_.compact(_.concat(erc20Txs, poolTxs, creditDeskTxs)), 'blockNumber'));

  const data = {
    address: address,
    usdcBalance: usdcBalance,
    usdcBalanceInDollars: new BigNumber(usdcFromAtomic(usdcBalance)),
    allowance: allowance,
    usdcIsUnlocked: !allowance || allowance.gte(new BigNumber(10000)),
    pastTXs: allTxs,
    loaded: true,
  };
  return data;
}

async function getAndTransformERC20Events(erc20, spender, owner) {
  const approvalEvents = await erc20.getPastEvents('Approval', {
    filter: { owner: owner, spender: spender },
    fromBlock: 'earliest',
    to: 'latest',
  });
  return await Promise.all(mapEventsToTx(_.compact(approvalEvents)));
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
  return await Promise.all(mapEventsToTx(poolEvents));
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
  return await Promise.all(mapEventsToTx(creditDeskEvents));
}

function mapEventsToTx(events) {
  return _.map(events, mapEventToTx);
}

function mapEventToTx(event) {
  return web3.eth.getBlock(event.blockNumber).then(block => {
    return {
      type: EVENT_TYPE_MAP[event.event],
      amount: usdcFromAtomic(event.returnValues[EVENT_AMOUNT_FIELD[event.event]]),
      id: event.transactionHash,
      blockNumber: event.blockNumber,
      date: moment.unix(block.timestamp).format('MMM DD, h:mma'),
      status: 'successful',
    };
  });
}

export { getUserData };
