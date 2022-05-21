import {
  isWalletModalOpenVar,
  isKYCModalOpenVar,
  isUIDModalOpenVar,
  isVerificationModalOpenVar,
} from "../vars";

export function openWalletModal() {
  isWalletModalOpenVar(true);
}

export function closeWalletModal() {
  isWalletModalOpenVar(false);
}

export function openKYCModal() {
  isKYCModalOpenVar(true);
}

export function closeKYCModal() {
  isKYCModalOpenVar(false);
}

export function openUIDModal() {
  isUIDModalOpenVar(true);
}

export function closeUIDModal() {
  isUIDModalOpenVar(false);
}

export function openVerificationModal() {
  isVerificationModalOpenVar(true);
}

export function closeVerificationModal() {
  isVerificationModalOpenVar(false);
}
