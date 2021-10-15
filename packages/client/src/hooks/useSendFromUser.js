import {useContext} from "react"
import {AppContext} from "../App"
import web3 from "../web3"

function useSendFromUser() {
  const {refreshUserData, user, networkMonitor} = useContext(AppContext)

  async function sendTransaction(unsentAction, txData, gasPrice, options) {
    // unsent action could be a promise that returns the action, so resolve it
    unsentAction = await Promise.resolve(unsentAction)

    // Gasless transactions
    if (txData.gasless) {
      // We need to assign it a temporary id, so we can update it if we get an error back
      // (since we only get a txid if relay call succeed)
      txData = networkMonitor.addPendingTX({status: "pending", ...txData})
      return new Promise((resolve) => {
        unsentAction()
          .then((res) => {
            if (res.status === "success") {
              const txResult = JSON.parse(res.result)
              networkMonitor.watch(txResult.txHash, txData, () => {
                refreshUserData()
                resolve()
              })
            } else {
              networkMonitor.markTXErrored(txData, {message: res.message})
              resolve()
            }
          })
          .catch((error) => {
            networkMonitor.markTXErrored(txData, {message: error.message})

            if (options.rejectOnError) {
              throw error
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
            refreshUserData()
            resolve()
          })
        })
        .on("error", (error) => {
          if (error.code === -32603) {
            error.message = "Something went wrong with your transaction."
          }
          networkMonitor.markTXErrored(txData, error)

          if (options.rejectOnError) {
            reject(error)
          } else {
            resolve()
          }
        })
    })
  }

  return (unsentAction, txData, options) => {
    options = options || {}

    return web3.eth.getGasPrice().then(
      async (gasPrice) => {
        try {
          await sendTransaction(unsentAction, txData, gasPrice, options)
        } catch (err) {
          console.log(`Error sending transaction: ${err}`)

          if (options.rejectOnError) {
            throw err
          }
        }
      },
      (err) => {
        console.log(`Unable to get gas price: ${err}`)

        if (options.rejectOnError) {
          throw err
        }
      }
    )
  }
}

export default useSendFromUser
