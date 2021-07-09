import { useContext } from "react"
import { AppContext } from "../App"
import web3 from "../web3"

function useSendFromUser() {
  const { refreshUserData, user, gnosisSafeInfo, gnosisSafeSdk, networkMonitor } = useContext(AppContext)

  async function sendTransaction(unsentAction, txData, gasPrice) {
    // unsent action could be a promise tha returns the action, so resolve it
    unsentAction = await Promise.resolve(unsentAction)
    if (gnosisSafeInfo) {
      const txs = [
        {
          to: unsentAction._parent._address, // _parent is the truffle contract
          value: 0,
          data: unsentAction.encodeABI(),
        },
      ]
      txData = networkMonitor.addPendingTX({ status: "awaiting_signers", ...txData })
      const res = await gnosisSafeSdk.sendTransactions(txs)
      networkMonitor.watch(res.safeTxHash, txData, () => {
        refreshUserData()
      })
      return Promise.resolve(res)
    }

    // Gasless transactions
    if (txData.gasless) {
      // We need to assign it a temporary id, so we can update it if we get an error back
      // (since we only get a txid if relay call succeed)
      txData = networkMonitor.addPendingTX({ status: "pending", ...txData })
      return new Promise(resolve => {
        unsentAction()
          .then(res => {
            if (res.status === "success") {
              const txResult = JSON.parse(res.result)
              networkMonitor.watch(txResult.txHash, txData, () => {
                refreshUserData()
                resolve()
              })
            } else {
              networkMonitor.markTXErrored(txData, { message: res.message })
              resolve()
            }
          })
          .catch(error => {
            networkMonitor.markTXErrored(txData, { message: error.message })
            resolve()
          })
      })
    }

    return new Promise(resolve => {
      unsentAction
        .send({
          from: user.address,
          gasPrice: gasPrice,
        })
        .once("sent", _ => {
          txData = networkMonitor.addPendingTX(txData)
        })
        .once("transactionHash", transactionHash => {
          txData = networkMonitor.watch(transactionHash, txData, () => {
            refreshUserData()
            resolve()
          })
        })
        .on("error", error => {
          if (error.code === -32603) {
            error.message = "Something went wrong with your transaction."
          }
          networkMonitor.markTXErrored(txData, error)
          resolve()
        })
    })
  }

  return (unsentAction, txData) => {
    return web3.eth.getGasPrice().then(
      async gasPrice => {
        try {
          await sendTransaction(unsentAction, txData, gasPrice)
        } catch (err) {
          console.log(`Error sending transaction: ${err}`)
        }
      },
      error => {
        console.log(`Unable to get gas price: ${error}`)
      },
    )
  }
}

export default useSendFromUser
