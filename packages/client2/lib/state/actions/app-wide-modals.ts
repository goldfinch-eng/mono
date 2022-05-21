import { isWalletModalOpenVar, isVerificationModalOpenVar } from "../vars";

export function openWalletModal() {
  isWalletModalOpenVar(true);
}

export function closeWalletModal() {
  isWalletModalOpenVar(false);
}

export function openVerificationModal() {
  isVerificationModalOpenVar(true);
}

export function closeVerificationModal() {
  isVerificationModalOpenVar(false);
}
