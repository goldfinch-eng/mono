import type { KycStatusResponse } from "@goldfinch-eng/utils";
import { Provider } from "@wagmi/core";
import { Signer } from "ethers";

import { API_BASE_URL, UNIQUE_IDENTITY_SIGNER_URL } from "@/constants";

import { UidType } from "./graphql/generated";

function setCachedSignature(cacheKey: string, sig: KycSignature) {
  sessionStorage.setItem(cacheKey, JSON.stringify(sig));
}

async function getCachedSignature(
  cacheKey: string,
  provider: Provider,
  maxFreshness = 3600
): Promise<KycSignature | null> {
  try {
    const cachedSig = JSON.parse(
      sessionStorage.getItem(cacheKey) as string
    ) as KycSignature;
    const { plaintext, signature, signatureBlockNum } = cachedSig;
    const currentBlockTime = (await provider.getBlock("latest")).timestamp;
    const cachedBlockTime = (
      await provider.getBlock(cachedSig.signatureBlockNum)
    ).timestamp;
    if (currentBlockTime - cachedBlockTime > maxFreshness) {
      return null;
    }
    return {
      plaintext,
      signature,
      signatureBlockNum,
    };
  } catch {
    return null;
  }
}

/**
 * The message that is expected for the /kycStatus cloud function's
 * signature verification. This is also the message presented to the
 * user in their preferred wallet extension (e.g. Metamask) when we
 * request their signature before initiating the kyc process.
 * @param blockNumber current block number of the currently selected chain
 */
export function getMessageToSign(blockNumber: number): string {
  return `Sign in to Goldfinch: ${blockNumber}`;
}

export interface KycSignature {
  plaintext: string;
  signature: string;
  signatureBlockNum: number;
}
export async function getSignatureForKyc(
  provider: Provider,
  signer: Signer,
  plaintext?: string
) {
  try {
    const currentBlock = await provider.getBlock("latest");
    const blockNumber = currentBlock.number;
    const msg = plaintext ?? getMessageToSign(blockNumber);
    const cacheKey = plaintext ?? "get-kyc-status";

    const cachedSig = await getCachedSignature(cacheKey, provider);
    if (cachedSig) {
      return cachedSig;
    }

    const signature = await signer.signMessage(msg);
    const kycSignature = {
      plaintext: msg,
      signature,
      signatureBlockNum: blockNumber,
    };
    setCachedSignature(cacheKey, kycSignature);
    return kycSignature;
  } catch {
    throw new Error("Failed to get signature from user");
  }
}

function convertSignatureToAuth(account: string, signature: KycSignature) {
  return {
    "x-goldfinch-address": account,
    "x-goldfinch-signature": signature.signature,
    "x-goldfinch-signature-plaintext": signature.plaintext,
    "x-goldfinch-signature-block-num": signature.signatureBlockNum.toString(),
  };
}

export async function fetchKycStatus(account: string, signature: KycSignature) {
  const url = `${API_BASE_URL}/kycStatus`;
  const auth = convertSignatureToAuth(account, signature);
  const response = await fetch(url, { headers: auth });
  if (!response.ok) {
    throw new Error("Could not get KYC status");
  }
  const result: KycStatusResponse = await response.json();
  return result;
}

export async function registerKyc(account: string, signature: KycSignature) {
  const url = `${API_BASE_URL}/registerKyc`;
  const auth = convertSignatureToAuth(account, signature);
  const response = await fetch(url, { method: "POST", headers: auth });
  if (!response.ok) {
    throw new Error("Failed to register auth code for Parallel Markets");
  }
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
export function getUIDLabelFromType(type: UIDType) {
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

const uidTypeToLabel: Record<UidType, string> = {
  NON_US_INDIVIDUAL: "Non-U.S. Individual",
  US_ACCREDITED_INDIVIDUAL: "U.S. Accredited Individual",
  US_NON_ACCREDITED_INDIVIDUAL: "U.S. Non-Accredited Individual",
  US_ENTITY: "U.S. Entity",
  NON_US_ENTITY: "Non-U.S. Entity",
};
export function getUIDLabelFromGql(type: UidType) {
  return uidTypeToLabel[type];
}

export async function fetchUniqueIdentitySigner(
  account: string,
  signature: KycSignature,
  mintToAddress?: string
) {
  const url = UNIQUE_IDENTITY_SIGNER_URL;
  const auth = convertSignatureToAuth(account, signature);
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ auth, mintToAddress }),
    method: "POST",
  });
  if (!res.ok) {
    const message = (await res.json()).message as string;
    const actualMessage = message?.match(/\"message\"\:\"(.+)\"/);
    if (actualMessage) {
      throw new Error(actualMessage[1]);
    } else {
      throw new Error("Unique indentity signer responded with an error");
    }
  }
  const response = await res.json();
  const parsedBody: {
    signature: string;
    expiresAt: number;
    uidType: UIDType;
  } = JSON.parse(response.result);
  return parsedBody;
}

export async function postKYCDetails(
  account: string,
  signature: KycSignature,
  residency: string
) {
  const url = `${API_BASE_URL}/setUserKYCData`;
  const auth = convertSignatureToAuth(account, signature);
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
