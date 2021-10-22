import {useContext} from "react"
import {AppContext} from "../App"
import {assertNonNullable} from "../utils"
import web3 from "../web3"

type UseSendFromUserOptions = {
  rejectOnError: boolean
}

type SendTransactionOptions = {
  rejectOnError: boolean
}

function useSendFromUser() {
  const {refreshUserData, user, networkMonitor} = useContext(AppContext)

  async function sendTransaction(unsentAction, txData, gasPrice, options: SendTransactionOptions) {
    assertNonNullable(networkMonitor)
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
                assertNonNullable(refreshUserData)
                refreshUserData()
                resolve()
              })
            } else {
              // @ts-expect-error ts-migrate(2532) FIXME: Object is possibly 'undefined'.
              networkMonitor.markTXErrored(txData, {message: res.message})
              resolve()
            }
          })
          .catch((err: unknown) => {
            // @ts-expect-error ts-migrate(2532) FIXME: Object is possibly 'undefined'.
            networkMonitor.markTXErrored(txData, {message: err.message})

            if (options.rejectOnError) {
              reject(err)
            } else {
              resolve()
            }
          })
      })
    }

    return new Promise((resolve, reject) => {
      unsentAction
        .send({
          from: user.address,
          gasPrice: gasPrice,
        })
        .once("sent", (_) => {
          txData = networkMonitor.addPendingTX(txData)
        })
        .once("transactionHash", (transactionHash) => {
          txData = networkMonitor.watch(transactionHash, txData, () => {
            // @ts-expect-error ts-migrate(2722) FIXME: Cannot invoke an object which is possibly 'undefin... Remove this comment to see the full error message
            refreshUserData()
            // @ts-expect-error ts-migrate(2794) FIXME: Expected 1 arguments, but got 0. Did you forget to... Remove this comment to see the full error message
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
            // @ts-expect-error ts-migrate(2794) FIXME: Expected 1 arguments, but got 0. Did you forget to... Remove this comment to see the full error message
            resolve()
          }
        })
    })
  }

  return (unsentAction, txData, options: UseSendFromUserOptions = {rejectOnError: false}) => {
    return web3.eth.getGasPrice().then(
      async (gasPrice) => {
        try {
          await sendTransaction(unsentAction, txData, gasPrice, options)
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
