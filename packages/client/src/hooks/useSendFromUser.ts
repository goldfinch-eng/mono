import {useContext} from "react"
import {AppContext} from "../App"
import {assertError, assertNonNullable} from "../utils"
import web3 from "../web3"

type UseSendFromUserOptions = {
  rejectOnError: boolean
}

type SendTransactionOptions = {
  rejectOnError: boolean
}

function useSendFromUser() {
  const {refreshCurrentBlock, user, networkMonitor} = useContext(AppContext)

  async function sendTransaction(unsentAction, txData, {gasPrice, value}, options: SendTransactionOptions) {
    assertNonNullable(refreshCurrentBlock)
    assertNonNullable(networkMonitor)
    assertNonNullable(user)
    // unsent action could be a promise that returns the action, so resolve it
    unsentAction = await Promise.resolve(unsentAction)

    // Gasless transactions
    if (txData.gasless) {
      // We need to assign it a temporary id, so we can update it if we get an error back
      // (since we only get a txid if relay call succeed)
      txData = networkMonitor.addPendingTX({status: "pending", ...txData})
      return new Promise<void>((resolve, reject) => {
        unsentAction()
          .then((res) => {
            if (res.status === "success") {
              const txResult = JSON.parse(res.result)
              networkMonitor.watch(txResult.txHash, txData, () => {
                refreshCurrentBlock()
                resolve()
              })
            } else {
              networkMonitor.markTXErrored(txData, new Error(res.message))
              resolve()
            }
          })
          .catch((err: unknown) => {
            assertError(err)
            networkMonitor.markTXErrored(txData, err)

            if (options.rejectOnError) {
              reject(err)
            } else {
              resolve()
            }
          })
      })
    }

    return new Promise<void>((resolve, reject) => {
      unsentAction
        .send({
          from: user.address,
          gasPrice,
          value,
        })
        .once("sent", (_) => {
          txData = networkMonitor.addPendingTX(txData)
        })
        .once("transactionHash", (transactionHash) => {
          txData = networkMonitor.watch(transactionHash, txData, () => {
            refreshCurrentBlock()
            resolve()
          })
        })
        .on("error", (err) => {
          if (err.code === -32603) {
            err.message = "Something went wrong with your transaction."
          }
          networkMonitor.markTXErrored(txData, err)

          if (options.rejectOnError) {
            reject(err)
          } else {
            resolve()
          }
        })
    })
  }

  return (
    unsentAction,
    txData,
    {value}: {value?: string} = {},
    options: UseSendFromUserOptions = {rejectOnError: false}
  ) => {
    return web3.eth.getGasPrice().then(
      async (gasPrice) => {
        try {
          await sendTransaction(unsentAction, txData, {gasPrice, value}, options)
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
