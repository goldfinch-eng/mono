import {useContext} from "react"
import {AppContext} from "../App"
import {CurrentTxDataByType, PendingCurrentTx, TxType} from "../types/transactions"
import {assertErrorLike, assertNonNullable, isCodedErrorLike} from "../utils"
import getWeb3 from "../web3"

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
            if (process.env.NODE_ENV === "test") {
              // HACK: In testing environment (where we mock web3 calls using the depay-web3-mock library),
              // we observed the `sent` event not being emitted before the `transactionHash` event. This
              // may be a flaw in that library, which we'll let slide here because -- as long as we don't
              // reject here -- that flaw doesn't impact our ability to establish in our tests that we sent
              // the transaction we intended to send.
              resolve()
            } else {
              reject("Expected transaction to have been sent, before `transactionHash` event.")
            }
          }
        })
        .on("error", (err: unknown) => {
          assertErrorLike(err)
          if (working) {
            if (isCodedErrorLike(err) && err.code === -32603) {
              err.message = "Something went wrong with your transaction."
            }
            networkMonitor.markTXErrored(working, err)
          } else {
            reject("Expected transaction to have been sent, before `error` event.")
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
    const web3 = getWeb3()
    return web3.userWallet.eth.getGasPrice().then(
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
