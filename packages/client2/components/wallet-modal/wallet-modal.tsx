import { useEffect } from "react";
import { useAccount, useConnect } from "wagmi";

import { Modal, ModalProps, Paragraph, Link } from "@/components/design-system";
import { DESIRED_CHAIN_ID } from "@/constants";

import { ConnectorButton } from "./connector-button";

interface WalletModalProps {
  isOpen: ModalProps["isOpen"];
  onClose: ModalProps["onClose"];
}

export function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const { address, connector: activeConnector } = useAccount();
  const { connect, connectors, error, pendingConnector, isLoading } =
    useConnect();
  useEffect(() => {
    if (address) {
      setTimeout(() => onClose(), 500); // 500ms delay allows the checkmark to appear and makes the transition look smoother
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
        {connectors.map((connector) => (
          <ConnectorButton
            key={connector.id}
            connectorId={connector.id}
            connectorName={
              connector.id === "walletConnectLegacy"
                ? "WalletConnect"
                : connector.name
            }
            onClick={() => connect({ connector, chainId: DESIRED_CHAIN_ID })}
            isLoading={isLoading && pendingConnector?.id === connector.id}
            errorMessage={
              error && pendingConnector?.id === connector.id
                ? error.message
                : undefined
            }
            disabled={!connector.ready}
            isAlreadyActive={activeConnector?.id === connector.id}
          />
        ))}
        {error && !pendingConnector ? (
          <div className="mt-1 text-clay-500">{error.message}</div>
        ) : null}
      </div>
      <div className="mt-8 text-center">
        <Link href="https://metamask.io">I don&apos;t have a wallet</Link>
      </div>
    </Modal>
  );
}
