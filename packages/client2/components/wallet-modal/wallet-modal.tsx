import { useEffect } from "react";
import { useAccount } from "wagmi";

import { Modal, ModalProps, Paragraph, Link } from "@/components/design-system";

import { CoinbaseWalletButton } from "./coinbase-wallet-button";
import { MetaMaskButton } from "./metamask-button";
import { WalletConnectButton } from "./walletconnect-button";

interface WalletModalProps {
  isOpen: ModalProps["isOpen"];
  onClose: ModalProps["onClose"];
}

export function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const { address } = useAccount();

  // TODO use onConnect instead of this
  useEffect(() => {
    if (address) {
      onClose();
    }
  }, [address, onClose]);
  return (
    <Modal size="xs" title="Select a wallet" isOpen={isOpen} onClose={onClose}>
      <Paragraph className="mb-8">
        By connecting your wallet, you agree to our{" "}
        <Link href="/terms">Terms of Service</Link> and{" "}
        <Link href="/privacy">Privacy Policy</Link>
      </Paragraph>
      <div className="flex flex-col items-stretch space-y-2">
        <MetaMaskButton />
        {/* <WalletConnectButton />
        <CoinbaseWalletButton /> */}
      </div>
      <div className="mt-8 text-center">
        <Link href="https://metamask.io">I don&apos;t have a wallet</Link>
      </div>
    </Modal>
  );
}
