import { ContractTransaction } from "ethers";
import { toast } from "react-toastify";

import { Link } from "@/components/design-system";

import { waitForSubgraphBlock } from "./utils";

interface Args {
  transaction: ContractTransaction;
  pendingPrompt?: string;
  successPrompt?: string;
  errorPrompt?: string;
}

/**
 * Utility function meant to help inform users of submitted transactions. Waits for the transaction to be confirmed and for the subgraph to update.
 * @param props Options for the prompt. Only required option is `transaction`, an instance of a ContractTransaction
 * @returns Promise that resolves after the transaction has finished processing, including waiting for the subgraph to ingest that transaction.
 */
export async function toastTransaction({
  transaction,
  pendingPrompt,
  successPrompt,
  errorPrompt,
}: Args) {
  const transactionHash = transaction.hash;
  const promise = transaction
    .wait()
    .then((receipt) => waitForSubgraphBlock(receipt.blockNumber));
  return toast.promise(promise, {
    pending: {
      render() {
        return (
          <div>
            {pendingPrompt ? pendingPrompt : "Transaction submitted."} View it
            on{" "}
            <Link href={`https://etherscan.io/tx/${transactionHash}`}>
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
            <Link href={`https://etherscan.io/tx/${transactionHash}`}>
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
            <Link href={`https://etherscan.io/tx/${transactionHash}`}>
              etherscan.io
            </Link>
            .
          </div>
        );
      },
    },
  });
}
