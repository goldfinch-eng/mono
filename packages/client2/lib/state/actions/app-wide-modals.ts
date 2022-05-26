import { isWalletModalOpenVar } from "../vars";

export function openWalletModal() {
  isWalletModalOpenVar(true);
}

export function closeWalletModal() {
  isWalletModalOpenVar(false);
}
