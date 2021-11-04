import {useContext} from "react"
import {AppContext} from "../App"
import {CurrentTxDataByType, PendingCurrentTx, TxType} from "../ethereum/transactions"
import {assertError, assertNonNullable} from "../utils"
import web3 from "../web3"

type UseSendFromUserOptions = {
  value?: string
  rejectOnError?: boolean
}

type SendTransactionOptions = {
  rejectOnError: boolean
}

export type TxData<T extends TxType> = {
  type: T
  data: CurrentTxDataByType[T]
  gasless?: boolean
}

function useSendFromUser() {
  const {refreshCurrentBlock, user, networkMonitor} = useContext(AppContext)

  async function sendTransaction<T extends TxType>(
    unsentAction,
    txData: TxData<T>,
    {gasPrice, value}: {gasPrice: string; value: string | undefined},
    options: SendTransactionOptions
  ) {
    assertNonNullable(refreshCurrentBlock)
    assertNonNullable(networkMonitor)
    assertNonNullable(user)
    // unsent action could be a promise that returns the action, so resolve it
    unsentAction = await Promise.resolve(unsentAction)

    // Gasless transactions
    if (txData.gasless) {
      // We need to assign it a temporary id, so we can update it if we get an error back
      // (since we only get a txid if relay call succeed)
      const pendingTx = networkMonitor.addPendingTX(txData)
      return new Promise<void>((resolve, reject) => {
        unsentAction()
          .then((res) => {
            if (res.status === "success") {
              const txResult = JSON.parse(res.result)
              networkMonitor.watch(txResult.txHash, pendingTx, () => {
                refreshCurrentBlock()
                resolve()
              })
            } else {
              networkMonitor.markTXErrored(pendingTx, new Error(res.message))
              resolve()
            }
          })
          .catch((err: unknown) => {
            assertError(err)
            networkMonitor.markTXErrored(pendingTx, err)

            if (options.rejectOnError) {
              reject(err)
            } else {
              resolve()
            }
          })
      })
    }

    return new Promise<void>((resolve, reject) => {
      let working: PendingCurrentTx<T> | undefined
      unsentAction
        .send({
          from: user.address,
          gasPrice,
          value,
        })
        .once("sent", (_) => {
          working = networkMonitor.addPendingTX(txData)
        })
        .once("transactionHash", (transactionHash) => {
          if (working) {
            working = networkMonitor.watch(transactionHash, working, () => {
              refreshCurrentBlock()
              resolve()
            })
          } else {
            reject("Expected transaction to have been sent.")
          }
        })
        .on("error", (err) => {
          if (working) {
            if (err.code === -32603) {
              err.message = "Something went wrong with your transaction."
            }
            networkMonitor.markTXErrored(working, err)
          } else {
            reject("Expected transaction to have been sent.")
          }

          if (options.rejectOnError) {
            reject(err)
          } else {
            resolve()
          }
        })
    })
  }

  return function sendFromUser<U extends TxType>(
    unsentAction,
    txData: TxData<U>,
    options: UseSendFromUserOptions = {}
  ) {
    return web3.eth.getGasPrice().then(
      async (gasPrice) => {
        try {
          await sendTransaction(
            unsentAction,
            txData,
            {gasPrice, value: options.value},
            {rejectOnError: options.rejectOnError || false}
          )
        } catch (err: unknown) {
          console.log(`Error sending transaction: ${err}`)

          if (options.rejectOnError) {
            throw err
          }
        }
      },
      (err: unknown) => {
        console.log(`Unable to get gas price: ${err}`)

        if (options.rejectOnError) {
          throw err
        }
      }
    )
  }
}

export default useSendFromUser
