import BN from 'bn.js';
import web3 from '../web3.js';
import { useContext } from 'react';
import { AppContext } from '../App.js';
import { CONFIRMATION_THRESHOLD } from '../ethereum/utils';

function useTXLoading({
  action,
  txData,
  setIsPending,
  postAction = receipt => {
    return receipt;
  },
  sendFromUser,
}) {
  const { addPendingTX, markTXSuccessful, markTXErrored, updateTX, refreshUserData, user, network } = useContext(
    AppContext,
  );
  let tx = { ...txData };
  return (...args) => {
    let wrappedAction = (...args) => {
      return action(...args);
    };
    if (sendFromUser) {
      wrappedAction = sendFromUserWithTracking(action(...args), user.address);
    }
    return wrappedAction(...args).then(postAction);
  };

  function sendFromUserWithTracking(unsentAction, userAddress) {
    return () => {
      return web3.eth.getGasPrice().then(gasPrice => {
        return unsentAction
          .send({
            from: userAddress,
            gasPrice: new BN(String(gasPrice)),
          })
          .once('sent', _ => {
            tx = addPendingTX(tx);
            setIsPending(true);
          })
          .once('transactionHash', transactionHash => {
            tx.id = transactionHash;
            updateTX(tx, { id: transactionHash });
          })
          .once('receipt', receipt => {
            updateTX(tx, { id: receipt.transactionHash, blockNumber: receipt.blockNumber });
            if (network === 'localhost') {
              // The confirmation callback never runs on localhost...
              markTXSuccessful(tx);
              setIsPending(false);
              refreshUserData();
            }
          })
          .on('confirmation', (confNumber, receipt, latestBlockHash) => {
            updateTX(tx, { confirmations: confNumber });
            if (confNumber >= CONFIRMATION_THRESHOLD) {
              markTXSuccessful(tx);
              setIsPending(false);
              refreshUserData();
            }
          })
          .on('error', error => {
            if (error.code === -32603) {
              error.message = 'Something went wrong with your transaction.';
            }
            markTXErrored(tx, error);
            setIsPending(false);
          });
      });
    };
  }
}

export default useTXLoading;
