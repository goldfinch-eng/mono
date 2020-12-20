import BigNumber from 'bignumber.js';
import { usdcFromAtomic } from './erc20.js';
import _ from 'lodash';
import { getFromBlock } from './utils.js';
import { mapEventsToTx } from './events';

async function getUserData(address, usdc, pool, creditDesk) {
  let usdcBalance = new BigNumber(0);
  let allowance = new BigNumber(0);
  if (usdc) {
    usdcBalance = new BigNumber(await usdc.methods.balanceOf(address).call());
  }
  if (pool.loaded && usdc) {
    allowance = new BigNumber(await usdc.methods.allowance(address, pool._address).call());
  }
  const [usdcTxs, poolTxs, creditDeskTxs] = await Promise.all([
    getAndTransformERC20Events(usdc, pool._address, address),
    getAndTransformPoolEvents(pool, address),
    getAndTransformCreditDeskEvents(creditDesk, address),
  ]);
  const allTxs = _.reverse(_.sortBy(_.compact(_.concat(usdcTxs, poolTxs, creditDeskTxs)), 'blockNumber'));

  const user = {
    address: address,
    usdcBalance: usdcBalance,
    usdcBalanceInDollars: new BigNumber(usdcFromAtomic(usdcBalance)),
    allowance: allowance,
    usdcIsUnlocked: !allowance || allowance.gte(new BigNumber(10000)),
    pastTXs: allTxs,
    poolBalanceAsOf: poolBalanceAsOf,
    poolTxs: poolTxs,
    loaded: true,
  };
  return user;
}

function defaultUser() {
  return {
    loaded: true,
    poolBalanceAsOf: () => new BigNumber(0),
  };
}

async function getAndTransformERC20Events(usdc, spender, owner) {
  const approvalEvents = await usdc.getPastEvents('Approval', {
    filter: { owner: owner, spender: spender },
    fromBlock: 'earliest',
    to: 'latest',
  });
  return await mapEventsToTx(_.compact(approvalEvents));
}

async function getAndTransformPoolEvents(pool, address) {
  const poolEvents = await getPoolEvents(pool, address);
  return await mapEventsToTx(poolEvents);
}

async function getAndTransformCreditDeskEvents(creditDesk, address) {
  const fromBlock = getFromBlock(creditDesk.chain);
  const [paymentEvents, drawdownEvents] = await Promise.all(
    ['PaymentCollected', 'DrawdownMade'].map(eventName => {
      return creditDesk.getPastEvents(eventName, {
        filter: { payer: address, borrower: address },
        fromBlock: fromBlock,
        to: 'latest',
      });
    }),
  );
  const creditDeskEvents = _.compact(_.concat(paymentEvents, drawdownEvents));
  return await mapEventsToTx(creditDeskEvents);
}

function poolBalanceAsOf(dt) {
  const filtered = _.filter(this.poolTxs, tx => {
    return tx.blockTime < dt;
  });
  if (!filtered.length) {
    return new BigNumber(0);
  }
  return BigNumber.sum.apply(
    null,
    filtered.map(tx => {
      if (tx.type === 'WithdrawalMade') {
        return tx.amountBN.multipliedBy(new BigNumber(-1));
      } else {
        return tx.amountBN;
      }
    }),
  );
}

async function getPoolEvents(pool, address, events = ['DepositMade', 'WithdrawalMade']) {
  const fromBlock = getFromBlock(pool.chain);
  const [depositEvents, withdrawalEvents] = await Promise.all(
    events.map(eventName => {
      return pool.getPastEvents(eventName, {
        filter: { capitalProvider: address },
        fromBlock: fromBlock,
        to: 'latest',
      });
    }),
  );
  return _.compact(_.concat(depositEvents, withdrawalEvents));
}

export { getUserData, getPoolEvents, defaultUser };
