import Notify, {API as NotifyAPI} from "bnc-notify"
import _ from "lodash"
import moment from "moment"
import Web3 from "web3"
import {CONFIRMATION_THRESHOLD} from "../ethereum/utils"
import {Subscription} from "web3-core-subscriptions"
import {BlockHeader} from "web3-eth"
import {AbstractProvider} from "web3-core"
import {assertNonNullable, BlockInfo} from "../utils"
import {CurrentTx, CurrentTxDataByType, FailedCurrentTx, PendingCurrentTx, TxType} from "../types/transactions"
import {PlainObject} from "@goldfinch-eng/utils/src/type"

const NOTIFY_API_KEY = "8447e1ef-75ab-4f77-b98f-f1ade3bb1982"
const MURMURATION_CHAIN_ID = 31337

type SetCurrentTxs = (fn: (currentTx: CurrentTx<TxType>[]) => CurrentTx<TxType>[]) => void
type SetCurrentErrors = (fn: (currentErrors: any[]) => any[]) => void

class NetworkMonitor {
  userWalletWeb3: Web3
  currentBlockNumber: number
  currentTxs: CurrentTx<TxType>[]
  setCurrentTxs: SetCurrentTxs
  setCurrentErrors: SetCurrentErrors
  networkId!: number
  notifySdk!: NotifyAPI
  blockHeaderSubscription!: Subscription<BlockHeader>

  constructor(userWalletWeb3: Web3, state: {setCurrentTxs: SetCurrentTxs; setCurrentErrors: SetCurrentErrors}) {
    this.userWalletWeb3 = userWalletWeb3
    this.currentBlockNumber = 0
    this.currentTxs = []
    this.setCurrentTxs = state.setCurrentTxs
    this.setCurrentErrors = state.setCurrentErrors
  }

  async initialize(currentBlock: BlockInfo) {
    this.networkId = await this.userWalletWeb3.eth.getChainId()
    this.notifySdk = Notify({dappId: NOTIFY_API_KEY, networkId: this.networkId})
    this.currentBlockNumber = currentBlock.number
    this.blockHeaderSubscription = this.userWalletWeb3.eth.subscribe("newBlockHeaders")
    this.blockHeaderSubscription.on("data", (blockHeader) => {
      this.newBlockHeaderReceived(blockHeader)
    })

    if (process.env.REACT_APP_MURMURATION === "yes" && this.networkId !== MURMURATION_CHAIN_ID) {
      const currentProvider: AbstractProvider = this.userWalletWeb3.currentProvider as AbstractProvider
      assertNonNullable(currentProvider.request)
      await currentProvider.request({method: "wallet_switchEthereumChain", params: [{chainId: "0x7A69"}]})
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

  updatePendingTxs(): void {
    this.currentTxs
      .filter((tx): tx is CurrentTx<TxType> & {status: "pending"} => tx.status === "pending")
      .forEach((tx) => {
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

  watch<T extends TxType>(txHash: string, tx: PendingCurrentTx<T>, onConfirm): PendingCurrentTx<T> | undefined {
    let txData = tx

    // First ensure, the tx hash is up-to-date (pending transactions could have a different id)
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

  updateTX<T extends TxType, U extends PlainObject>(txToUpdate: PendingCurrentTx<T>, updates: U): void {
    this.setCurrentTxs((currentTxs) => {
      const matches = _.remove(currentTxs, {id: txToUpdate.id})
      const match = matches && matches[0]
      let tx: CurrentTx<TxType>
      if (match) {
        tx = {
          ...match,
          ...updates,
        }
      } else {
        throw new Error("Failed to identify transaction to update.")
      }
      const newTXs = _.reverse(_.sortBy(_.concat(currentTxs, tx), "blockNumber"))

      this.currentTxs = newTXs // Update local copy
      return newTXs
    })
  }

  addPendingTX<T extends TxType>(txData: {type: T; data: CurrentTxDataByType[T]}) {
    const randomID = Math.floor(Math.random() * Math.floor(1000000000))
    const tx: PendingCurrentTx<T> = {
      current: true,
      status: "pending",
      id: randomID,
      blockNumber: undefined,
      blockTime: moment().unix(),
      name: txData.type,
      confirmations: 0,
      onConfirm: undefined,
      errorMessage: undefined,
      ...txData,
    }
    if (this.isLocalNetwork) {
      // On a local network, we expect the transaction to be included in the next block to be mined.
      // We set this so that we can listen for the block to be mined and mark it successful in updatePendingTxs
      tx.blockNumber = this.currentBlockNumber + 1
    }
    this.setCurrentTxs((currentTxs) => {
      const newTxs: CurrentTx<TxType>[] = currentTxs.concat([tx as CurrentTx<TxType>])
      this.currentTxs = newTxs
      return newTxs
    })
    return tx
  }

  markTXSuccessful<T extends TxType>(tx: PendingCurrentTx<T>) {
    this.updateTX(tx, {status: "successful"})
  }

  markTXErrored<T extends TxType>(failedTX: PendingCurrentTx<T>, error: Error) {
    this.setCurrentTxs((currentTxs) => {
      const matches = _.remove(currentTxs, {id: failedTX.id}) as PendingCurrentTx<T>[]
      const match = matches && matches[0]
      let tx: FailedCurrentTx<T>
      if (match) {
        tx = {
          ...match,
          status: "error",
          errorMessage: error.message,
        }
      } else {
        throw new Error("Failed to identify pending transaction to mark as failed.")
      }
      const newTxs = currentTxs.concat([tx as CurrentTx<TxType>])
      this.currentTxs = newTxs
      return newTxs
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
