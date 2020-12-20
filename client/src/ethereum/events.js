import BigNumber from 'bignumber.js';
import web3 from '../web3.js';
import moment from 'moment';
import _ from 'lodash';
import { usdcFromAtomic } from './erc20.js';

const EVENT_TYPE_MAP = {
  DepositMade: 'Deposit',
  WithdrawalMade: 'Withdrawal',
  DrawdownMade: 'Borrow',
  PaymentCollected: 'Payment',
  Approval: 'Approval',
  InterestCollected: 'Interest Collected',
  PrincipalCollected: 'Principal Collected',
  ReserveFundsCollected: 'Reserve Funds Collected',
};

const EVENT_AMOUNT_FIELD = {
  WithdrawalMade: 'userAmount',
  DepositMade: 'amount',
  DrawdownMade: 'drawdownAmount',
  PaymentCollected: 'paymentAmount',
  InterestCollected: 'poolAmount',
  PrincipalCollected: 'amount',
  ReserveFundsCollected: 'amount',
  Approval: 'value',
};

async function mapEventsToTx(events) {
  const txs = await Promise.all(_.map(_.compact(events), mapEventToTx));
  return _.reverse(_.sortBy(txs, 'blockNumber'));
}

function mapEventToTx(event) {
  return web3.eth.getBlock(event.blockNumber).then(block => {
    return {
      type: event.event,
      name: EVENT_TYPE_MAP[event.event],
      amount: usdcFromAtomic(event.returnValues[EVENT_AMOUNT_FIELD[event.event]]),
      amountBN: new BigNumber(event.returnValues[EVENT_AMOUNT_FIELD[event.event]]),
      id: event.transactionHash,
      blockNumber: event.blockNumber,
      blockTime: block.timestamp,
      date: moment.unix(block.timestamp).format('MMM D, h:mma'),
      status: 'successful',
      eventId: event.id,
    };
  });
}

export { mapEventsToTx };
