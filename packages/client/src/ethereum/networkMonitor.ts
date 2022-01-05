import Notify, {API as NotifyAPI} from "bnc-notify"
import _ from "lodash"
import moment from "moment"
import Web3 from "web3"
import {CONFIRMATION_THRESHOLD} from "../ethereum/utils"
import {Subscription} from "web3-core-subscriptions"
import {BlockHeader} from "web3-eth"
import {AbstractProvider} from "web3-core"
import {assertNonNullable} from "../utils"

const NOTIFY_API_KEY = "8447e1ef-75ab-4f77-b98f-f1ade3bb1982"
const MURMURATION_CHAIN_ID = 31337
const MURMURATION_RPC_URL = "https://murmuration.goldfinch.finance/_chain"

class NetworkMonitor {
  web3: Web3
  currentBlockNumber: number
  currentTXs: any[]
  setCurrentTXs: (fn: (currentTx: any[]) => any[]) => void
  setCurrentErrors: (fn: (currentErrors: any[]) => any[]) => void
  networkId!: number
  notifySdk!: NotifyAPI
  blockHeaderSubscription!: Subscription<BlockHeader>

  constructor(web3, state) {
    this.web3 = web3
    this.currentBlockNumber = 0
    this.currentTXs = []
    this.setCurrentTXs = state.setCurrentTXs
    this.setCurrentErrors = state.setCurrentErrors
  }

  async initialize() {
    this.networkId = await this.web3.eth.getChainId()
    this.notifySdk = Notify({dappId: NOTIFY_API_KEY, networkId: this.networkId})
    this.currentBlockNumber = await this.web3.eth.getBlockNumber()
    this.blockHeaderSubscription = this.web3.eth.subscribe("newBlockHeaders")
    this.blockHeaderSubscription.on("data", (blockHeader) => {
      this.newBlockHeaderReceived(blockHeader)
    })

    if (process.env.REACT_APP_MURMURATION === "yes" && this.networkId !== MURMURATION_CHAIN_ID) {
      const currentProvider: AbstractProvider = this.web3.currentProvider as AbstractProvider
      assertNonNullable(currentProvider.request)
      try {
        await currentProvider.request({method: "wallet_switchEthereumChain", params: [{chainId: "0x7A69"}]})
      } catch (error: any) {
        if (error.code === 4902) {
          await currentProvider.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0x7A69",
                chainName: "Murmuration",
                rpcUrls: [MURMURATION_RPC_URL],
              },
            ],
          })
        }
      }
    }
  }

  get isLocalNetwork() {
    return this.networkId === 31337
  }

  newBlockHeaderReceived(blockHeader) {
    // We only care about confirmed blocks
    if (!blockHeader.number) {
      return
    }

    if (!this.currentBlockNumber || blockHeader.number > this.currentBlockNumber) {
      this.currentBlockNumber = blockHeader.number
      this.updatePendingTxs()
    }
  }

  updatePendingTxs() {
    _.filter(this.currentTXs, {status: "pending"}).forEach((tx) => {
      if (tx.blockNumber) {
        const confirmations = this.currentBlockNumber - tx.blockNumber + 1
        this.updateTX(tx, {confirmations: confirmations})

        if (confirmations === 1 && tx.onConfirm) {
          tx.onConfirm(tx)
        }

        if (confirmations >= CONFIRMATION_THRESHOLD) {
          this.markTXSuccessful(tx)
        } else if (this.isLocalNetwork && confirmations >= 1) {
          this.markTXSuccessful(tx)
        }
      }
    })
  }

  watch(txHash, tx, onConfirm) {
    let txData = tx

    // First ensure, the tx hash is upto date (pending transactions could have a different id)
    this.updateTX(txData, {id: txHash, onConfirm: onConfirm})
    txData.id = txHash

    if (this.isLocalNetwork) {
      // Blocknative does not work for the local network
      return
    }

    const {emitter} = this.notifySdk.hash(txHash)

    emitter.on("txConfirmed", (transaction) => {
      this.updateTX(txData, {
        blockNumber: transaction.blockNumber,
      })
    })
    emitter.on("txFailed", (error: any) => {
      if (error.code === -32603) {
        error.message = "Something went wrong with your transaction."
      }
      this.markTXErrored(txData, error)
    })
    return txData
  }

  updateTX(txToUpdate, updates) {
    this.setCurrentTXs((currentTXs) => {
      const matches = _.remove(currentTXs, {id: txToUpdate.id})
      const tx = matches && matches[0]
      const newTXs = _.reverse(_.sortBy(_.concat(currentTXs, {...tx, ...updates}), "blockTime"))

      this.currentTXs = newTXs // Update local copy
      return newTXs
    })
  }

  addPendingTX(txData) {
    const randomID = Math.floor(Math.random() * Math.floor(1000000000))
    const tx = {
      status: "pending",
      id: randomID,
      blockTime: moment().unix(),
      name: txData["type"],
      confirmations: 0,
      ...txData,
    }
    if (this.isLocalNetwork) {
      // On a local network, we expect the transaction to be included in the next block to be mined.
      // We set this so that we can listen for the block to be mined and mark it successful in updatePendingTxs
      tx.blockNumber = this.currentBlockNumber + 1
    }
    this.setCurrentTXs((currentTXs) => {
      const newTxs = _.concat(currentTXs, tx)
      this.currentTXs = newTxs
      return newTxs
    })
    return tx
  }

  markTXSuccessful(tx) {
    this.updateTX(tx, {status: "successful"})
  }

  markTXErrored(failedTX, error: Error) {
    this.setCurrentTXs((currentPendingTXs) => {
      const matches = _.remove(currentPendingTXs, {id: failedTX.id})
      const tx = matches && matches[0]
      tx.status = "error"
      tx.errorMessage = error.message
      const newPendingTxs = _.concat(currentPendingTXs, tx)
      this.currentTXs = newPendingTxs
      return newPendingTxs
    })
    this.setCurrentErrors((currentErrors) => {
      return _.concat(currentErrors, {id: failedTX.id, message: error.message})
    })
  }

  removeError(error) {
    this.setCurrentErrors((currentErrors) => {
      _.remove(currentErrors, {id: error.id})
      return _.cloneDeep(currentErrors)
    })
  }
}

export {NetworkMonitor}
