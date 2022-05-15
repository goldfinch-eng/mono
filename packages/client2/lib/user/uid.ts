import { APPROVED_ADDRESSES } from "@/constants/approved-addresses";

import type { IKYCStatus } from "./kyc";

export enum UIDType {
  NonUSIndividual = 0,
  USAccreditedIndividual = 1,
  USNonAccreditedIndividual = 2,
  USEntity = 3,
  NonUSEntity = 4,
}

/**
 * Get the UID Type for the wallet address
 * @param address Wallet address
 * @param kycStatus User's KYC status
 * @returns The UID Type of the user
 */
export function getUIDType(
  address: string,
  kycStatus: IKYCStatus
): UIDType | null {
  if (APPROVED_ADDRESSES.USEntities.indexOf(address.toLowerCase()) >= 0) {
    return UIDType.USEntity;
  } else if (
    APPROVED_ADDRESSES.NonUSEntities.indexOf(address.toLowerCase()) >= 0
  ) {
    return UIDType.NonUSEntity;
  } else if (
    APPROVED_ADDRESSES.USIndividuals.indexOf(address.toLowerCase()) >= 0
  ) {
    return UIDType.USAccreditedIndividual;
  } else if (kycStatus.countryCode !== "US") {
    return UIDType.NonUSIndividual;
  } else if (kycStatus.countryCode === "US") {
    return UIDType.USNonAccreditedIndividual;
  }

  return null;
}

/**
 * Export the UID title for the user's selected attributes
 * @param uidAttributes String array of attributes selected during KYC
 * @returns The label to describe the user's UID type
 */
export function getUIDLabel(uidAttributes: string[]): string {
  let label = [];

  if (uidAttributes.indexOf("usa") >= 0) {
    label.push("U.S.");
  }

  if (uidAttributes.indexOf("not-usa") >= 0) {
    label.push("Non-U.S.");
  }

  if (uidAttributes.indexOf("accredited") >= 0) {
    label.push("Accredited");
  }

  if (uidAttributes.indexOf("not-accredited") >= 0) {
    label.push("Non-accredited");
  }

  if (uidAttributes.indexOf("individual") >= 0) {
    label.push("Individual");
  }

  if (uidAttributes.indexOf("entity") >= 0) {
    label.push("Entity");
  }

  return label.join(" ");
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
