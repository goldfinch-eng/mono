/**
 * The general rule of thumb for deciding whether or not to place a modal in here is simply that it should be in here if it serves a purpose that shows up in multiple places throughout the app.
 */
import { useReactiveVar } from "@apollo/client";

import { KYCModal } from "@/components/kyc-modal";
import { UIDModal } from "@/components/uid-modal";
import { WalletModal } from "@/components/wallet-modal";

import { closeWalletModal, closeKYCModal, closeUIDModal } from "./actions";
import {
  isWalletModalOpenVar,
  isKYCModalOpenVar,
  isUIDModalOpenVar,
} from "./vars";

export function AppWideModals() {
  const isWalletModalOpen = useReactiveVar(isWalletModalOpenVar); // too lazy to write a full graphQL query just to read this from the Apollo cache, so i useReactiveVar on it
  const isKYCModalOpen = useReactiveVar(isKYCModalOpenVar);
  const isUIDModalOpen = useReactiveVar(isUIDModalOpenVar);

  return (
    <>
      <WalletModal isOpen={isWalletModalOpen} onClose={closeWalletModal} />
      <KYCModal isOpen={isKYCModalOpen} onClose={closeKYCModal} />
      <UIDModal isOpen={isUIDModalOpen} onClose={closeUIDModal} />
    </>
  );
}
