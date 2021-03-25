import Notify from 'bnc-notify';
import _ from 'lodash';
import moment from 'moment';
import { CONFIRMATION_THRESHOLD } from '../ethereum/utils';

const NOTIFY_API_KEY = '8447e1ef-75ab-4f77-b98f-f1ade3bb1982';

class NetworkMonitor {
  constructor(web3, state) {
    this.web3 = web3;
    this.currentBlockNumber = 0;
    this.currentTXs = [];
    this.setCurrentTXs = state.setCurrentTXs;
    this.setCurrentErrors = state.setCurrentErrors;
  }

  async initialize() {
    this.networkId = await this.web3.eth.getChainId();
    this.notifySdk = Notify({ dappId: NOTIFY_API_KEY, networkId: this.networkId });
    this.currentBlockNumber = await this.web3.eth.getBlockNumber();
    this.blockHeaderSubscription = this.web3.eth.subscribe('newBlockHeaders');
    this.blockHeaderSubscription.on('data', blockHeader => {
      this.newBlockHeaderReceived(blockHeader);
    });
  }

  newBlockHeaderReceived(blockHeader) {
    // We only care about confirmed blocks
    if (!blockHeader.number) {
      return;
    }

    if (!this.currentBlockNumber || blockHeader.number > this.currentBlockNumber) {
      this.currentBlockNumber = blockHeader.number;
      this.updatePendingTxs();
    }
  }

  updatePendingTxs() {
    _.filter(this.currentTXs, { status: 'pending' }).forEach(tx => {
      if (tx.blockNumber) {
        const confirmations = this.currentBlockNumber - tx.blockNumber + 1;
        this.updateTX(tx, { confirmations: confirmations });

        if (confirmations >= CONFIRMATION_THRESHOLD) {
          this.markTXSuccessful(tx);
        }
      }
    });
  }

  watch(txHash, tx, onSuccess) {
    let txData = tx;

    // First ensure, the tx hash is upto date (pending transactions could have a different id)
    this.updateTX(txData, { id: txHash, onSuccess: onSuccess });
    txData.id = txHash;

    const { emitter } = this.notifySdk.hash(txHash);

    emitter.on('txConfirmed', transaction => {
      this.updateTX(txData, {
        blockNumber: transaction.blockNumber,
      });
    });
    emitter.on('txFailed', error => {
      if (error.code === -32603) {
        error.message = 'Something went wrong with your transaction.';
      }
      this.markTXErrored(txData, error);
    });
    return txData;
  }

  updateTX(txToUpdate, updates) {
    this.setCurrentTXs(currentTXs => {
      const matches = _.remove(currentTXs, { id: txToUpdate.id });
      const tx = matches && matches[0];
      const newTXs = _.reverse(_.sortBy(_.concat(currentTXs, { ...tx, ...updates }), 'blockTime'));

      this.currentTXs = newTXs; // Update local copy
      return newTXs;
    });
  }

  addPendingTX(txData) {
    const randomID = Math.floor(Math.random() * Math.floor(1000000000));
    const tx = {
      status: 'pending',
      id: randomID,
      blockTime: moment().unix(),
      name: txData['type'],
      confirmations: 0,
      ...txData,
    };
    this.setCurrentTXs(currentTXs => {
      const newTxs = _.concat(currentTXs, tx);
      this.currentTXs = newTxs;
      return newTxs;
    });
    return tx;
  }

  markTXSuccessful(tx) {
    this.updateTX(tx, { status: 'successful' });
    if (tx.onSuccess) {
      tx.onSuccess(tx);
    }
  }

  markTXErrored(failedTX, error) {
    this.setCurrentTXs(currentPendingTXs => {
      const matches = _.remove(currentPendingTXs, { id: failedTX.id });
      const tx = matches && matches[0];
      tx.status = 'error';
      tx.errorMessage = error.message;
      const newPendingTxs = _.concat(currentPendingTXs, tx);
      this.currentTXs = newPendingTxs;
      return newPendingTxs;
    });
    this.setCurrentErrors(currentErrors => {
      return _.concat(currentErrors, { id: failedTX.id, message: error.message });
    });
  }

  removeError(error) {
    this.setCurrentErrors(currentErrors => {
      _.remove(currentErrors, { id: error.id });
      return _.cloneDeep(currentErrors);
    });
  }
}

export { NetworkMonitor };
