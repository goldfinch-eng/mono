import { ContractTransaction } from "ethers";
import { toast } from "react-toastify";

import { Link } from "@/components/design-system";

import { waitForSubgraphBlock } from "./utils";

interface Args {
  /**
   * Please note that this is a promise for a ContractTransaction.
   */
  transaction: Promise<ContractTransaction>;
  pendingPrompt?: string;
  successPrompt?: string;
  errorPrompt?: string;
}

/**
 * Utility function meant to help inform users of submitted transactions. Waits for the transaction to be confirmed and for the subgraph to update. Note that this also handles error messaging when the transaction fails.
 * @param props Options for the prompt. Only required option is `transaction`, an instance of a ContractTransaction
 * @returns Promise that resolves after the transaction has finished processing, including waiting for the subgraph to ingest that transaction.
 */
export async function toastTransaction({
  transaction,
  pendingPrompt,
  successPrompt,
  errorPrompt,
}: Args) {
  try {
    const submittedTransaction = await transaction;
    const transactionHash = submittedTransaction.hash;
    const promise = submittedTransaction
      .wait()
      .then((receipt) => waitForSubgraphBlock(receipt.blockNumber));
    return toast.promise(promise, {
      pending: {
        render() {
          return (
            <div>
              {pendingPrompt ? pendingPrompt : "Transaction submitted."} View it
              on{" "}
              <Link
                href={`https://etherscan.io/tx/${transactionHash}`}
                target="_blank"
                rel="noopener"
              >
                etherscan.io
              </Link>
              .
            </div>
          );
        },
      },
      success: {
        render() {
          return (
            <div>
              {successPrompt ? successPrompt : "Transaction succeeded."} View it
              on{" "}
              <Link
                href={`https://etherscan.io/tx/${transactionHash}`}
                target="_blank"
                rel="noopener"
              >
                etherscan.io
              </Link>
              .
            </div>
          );
        },
      },
      error: {
        render({ data }: { data: { message: string } }) {
          return (
            <div>
              {errorPrompt ? errorPrompt : `Transaction failed.`} Error message:{" "}
              {data.message}. View it on{" "}
              <Link
                href={`https://etherscan.io/tx/${transactionHash}`}
                target="_blank"
                rel="noopener"
              >
                etherscan.io
              </Link>
              .
            </div>
          );
        },
      },
    });
  } catch (error) {
    const errorMessage =
      (error as { data: { message: string } })?.data?.message ??
      (error as Error)?.message;
    toast.error(
      errorMessage
        ? `Transaction failed to submit with message: ${errorMessage}`
        : "Transaction failed to submit."
    );
    throw error;
  }
}
