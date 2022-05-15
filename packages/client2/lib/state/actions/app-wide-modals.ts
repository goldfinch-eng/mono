import {
  isWalletModalOpenVar,
  isKYCModalOpenVar,
  isUIDModalOpenVar,
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
