import { gql } from "@apollo/client";

import { apolloClient } from "@/lib/graphql/apollo";
import type { Signature } from "@/lib/graphql/generated";

import { getProvider } from "../wallet";

const GET_SIGNATURE = gql`
  query SignatureSetup {
    signature @client {
      signature
      signatureBlockNum
      signatureBlockNumTimestamp
    }
  }
`;

export function convertSignatureToAuth(
  account: string,
  signatureDetails: Signature | null
) {
  if (!signatureDetails) {
    return null;
  }

  return {
    "x-goldfinch-address": account,
    "x-goldfinch-signature": signatureDetails?.signature || "",
    "x-goldfinch-signature-block-num": (
      signatureDetails?.signatureBlockNum || ""
    ).toString(),
  };
}

export function getSignedMessage(blockNumber: number): string {
  return `Sign in to Goldfinch: ${blockNumber}`;
}

export async function getSignature(): Promise<Signature | null> {
  const provider = getProvider();

  if (!provider) {
    return null;
  }

  const sigFromCache = apolloClient.readQuery({ query: GET_SIGNATURE });

  if (sigFromCache) {
    return sigFromCache.signature;
  }

  try {
    const signer = provider.getSigner();
    const blockNumber = await provider.getBlockNumber();
    const currentBlock = await provider.getBlock(blockNumber);
    const currentBlockTimestamp = currentBlock.timestamp;

    const signature = await signer.signMessage(getSignedMessage(blockNumber));

    apolloClient.writeQuery({
      query: GET_SIGNATURE,
      data: {
        signature: {
          signature,
          signatureBlockNum: blockNumber,
          signatureBlockNumTimestamp: currentBlockTimestamp,
        },
      },
    });

    return {
      signature,
      signatureBlockNum: blockNumber,
      signatureBlockNumTimestamp: currentBlockTimestamp,
    };
  } catch {
    throw new Error("Unable to get walelt signature");
  }
}

type TUIDSignatureResponse = { signature: string; expiresAt: number };

export function asUIDSignatureResponse(obj: any): TUIDSignatureResponse {
  if (typeof obj.result !== "string") {
    throw new Error(`${obj} is not a signature response`);
  }

  const result = JSON.parse(obj.result);

  if (typeof result.signature !== "string") {
    throw new Error(`${obj} is not a signature response`);
  }

  if (typeof result.expiresAt !== "number") {
    throw new Error(`${obj} is not a signature response`);
  }

  return result;
}
