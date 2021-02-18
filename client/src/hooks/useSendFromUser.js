import { useContext } from 'react';
import { AppContext } from '../App.js';
import { CONFIRMATION_THRESHOLD } from '../ethereum/utils';
import web3 from '../web3';

function useSendFromUser() {
  const {
    addPendingTX,
    markTXSuccessful,
    markTXErrored,
    updateTX,
    refreshUserData,
    user,
    network,
    gnosisSafeInfo,
    gnosisSafeSdk,
  } = useContext(AppContext);

  async function sendTransaction(unsentAction, txData, gasPrice) {
    // unsent action could be a promise tha returns the action, so resolve it
    unsentAction = await Promise.resolve(unsentAction);
    if (gnosisSafeInfo) {
      const txs = [
        {
          to: unsentAction._parent._address, // _parent is the truffle contract
          value: 0,
          data: unsentAction.encodeABI(),
        },
      ];
      addPendingTX({ status: 'awaiting_signers', ...txData });
      const res = await gnosisSafeSdk.sendTransactions(txs);
      return Promise.resolve(res);
    }

    // Gasless transactions
    if (txData.gasless) {
      // We need to assign it a temporary id, so we can update it if we get an error back
      // (since we only get a txid if relay call succeed)
      txData.id = Date.now();
      addPendingTX({ status: 'pending', ...txData });
      return unsentAction.then(res => {
        if (res.success) {
          updateTX(txData, { id: res.hash });
        } else {
          markTXErrored(txData, { message: res.error });
        }
      });
    }

    return unsentAction
      .send({
        from: user.address,
        gasPrice: gasPrice,
      })
      .once('sent', _ => {
        txData = addPendingTX(txData);
      })
      .once('transactionHash', transactionHash => {
        txData.id = transactionHash;
        updateTX(txData, { id: transactionHash });
      })
      .once('receipt', receipt => {
        updateTX(txData, { id: receipt.transactionHash, blockNumber: receipt.blockNumber });
        if (network.name === 'localhost') {
          // The confirmation callback never runs on localhost...
          markTXSuccessful(txData);
          refreshUserData();
        }
      })
      .on('confirmation', (confNumber, receipt, latestBlockHash) => {
        updateTX(txData, { confirmations: confNumber });
        if (confNumber >= CONFIRMATION_THRESHOLD) {
          markTXSuccessful(txData);
          refreshUserData();
        }
      })
      .on('error', error => {
        if (error.code === -32603) {
          error.message = 'Something went wrong with your transaction.';
        }
        markTXErrored(txData, error);
      });
  }

  return (unsentAction, txData) => {
    return web3.eth.getGasPrice().then(
      async gasPrice => {
        try {
          await sendTransaction(unsentAction, txData, gasPrice);
        } catch (err) {
          console.log(`Error sending transaction: ${err}`);
        }
      },
      error => {
        console.log(`Unable to get gas price: ${error}`);
      },
    );
  };
}

export default useSendFromUser;
