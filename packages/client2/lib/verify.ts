import type { Web3Provider } from "@ethersproject/providers";

import { API_BASE_URL, UNIQUE_IDENTITY_SIGNER_URL } from "@/constants";

interface IKYCStatus {
  status: "unknown" | "approved" | "failed";
  countryCode: string;
}

function getSignedMessage(blockNumber: number): string {
  return `Sign in to Goldfinch: ${blockNumber}`;
}

export async function getSignatureForKyc(provider: Web3Provider) {
  try {
    const signer = provider.getSigner();
    const blockNumber = await provider.getBlockNumber();
    const currentBlock = await provider.getBlock(blockNumber);
    const currentBlockTimestamp = currentBlock.timestamp;

    const signature = await signer.signMessage(getSignedMessage(blockNumber));

    return {
      signature,
      signatureBlockNum: blockNumber,
      signatureBlockNumTimestamp: currentBlockTimestamp,
    };
  } catch {
    throw new Error("Failed to get signature from user");
  }
}

function convertSignatureToAuth(
  account: string,
  signature: string,
  signatureBlockNum: number
) {
  return {
    "x-goldfinch-address": account,
    "x-goldfinch-signature": signature,
    "x-goldfinch-signature-block-num": signatureBlockNum.toString(),
  };
}

export async function fetchKycStatus(
  account: string,
  signature: string,
  signatureBlockNum: number
) {
  const url = `${API_BASE_URL}/kycStatus`;
  const auth = convertSignatureToAuth(account, signature, signatureBlockNum);
  const response = await fetch(url, { headers: auth });
  if (!response.ok) {
    throw new Error("Could not get KYC status");
  }
  const result: IKYCStatus = await response.json();
  return result;
}

export enum UIDType {
  NonUSIndividual = 0,
  USAccreditedIndividual = 1,
  USNonAccreditedIndividual = 2,
  USEntity = 3,
  NonUSEntity = 4,
}

/**
 * Export the UID title for the user's UID Type
 * @param type The UID type of the wallet
 * @returns The label to describe the user's UID type
 */
export function getUIDLabelFromType(type: UIDType): string {
  switch (type) {
    case UIDType.NonUSIndividual:
      return "Non-U.S. Individual";
    case UIDType.USAccreditedIndividual:
      return "U.S. Accredited Individual";
    case UIDType.USNonAccreditedIndividual:
      return "U.S. Non-Accredited Individual";
    case UIDType.USEntity:
      return "U.S. Entity";
    case UIDType.NonUSEntity:
      return "Non-U.S. Entity";
  }
}

export async function fetchUniqueIdentitySigner(
  account: string,
  signature: string,
  signatureBlockNum: number
) {
  const url = UNIQUE_IDENTITY_SIGNER_URL;
  const auth = convertSignatureToAuth(account, signature, signatureBlockNum);
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ auth }),
    method: "POST",
  });
  if (!res.ok) {
    throw new Error("Unique indentity signer responded with an error");
  }
  const response = await res.json();
  const parsedBody: {
    signature: string;
    expiresAt: number;
    idVersion: UIDType;
  } = JSON.parse(response.result);
  return parsedBody;
}

export async function postKYCDetails(
  account: string,
  signature: string,
  signatureBlockNum: number,
  residency: string
) {
  const url = `${API_BASE_URL}/setUserKYCData`;
  const auth = convertSignatureToAuth(account, signature, signatureBlockNum);
  const response = await fetch(url, {
    headers: { ...auth, "Content-Type": "application/json" },
    method: "POST",
    body: JSON.stringify({ residency }),
  });

  if (!response.ok) {
    throw new Error("Could not set KYC data");
  }

  const result: { status: string } = await response.json();

  return result;
}
