import { Icon, Spinner } from "@/components/design-system";

import CoinbaseWalletLogo from "./coinbase-wallet-logo.svg";
import MetaMaskLogo from "./metamask-logo.svg";
import WalletConnectLogo from "./walletconnect-logo.svg";

const connectorIdToStyles = {
  metaMask: {
    ConnectorIcon: MetaMaskLogo,
    spinnerColor: "#f6851b",
  },
  walletConnect: {
    ConnectorIcon: WalletConnectLogo,
    spinnerColor: "#3f99fc",
  },
  coinbaseWallet: {
    ConnectorIcon: CoinbaseWalletLogo,
    spinnerColor: "#0052ff",
  },
};

interface ConnectorButtonProps {
  connectorId: string;
  connectorName: string;
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  errorMessage?: string;
  isAlreadyActive?: boolean;
}

export function ConnectorButton({
  connectorId,
  connectorName,
  onClick,
  disabled = false,
  isLoading,
  errorMessage,
  isAlreadyActive = false,
}: ConnectorButtonProps) {
  const { ConnectorIcon, spinnerColor } = connectorIdToStyles[
    connectorId as keyof typeof connectorIdToStyles
  ] ?? { ConnectorIcon: null, spinnerColor: "#000000" };
  return (
    <div>
      <button
        className="flex w-full items-center justify-between rounded-lg bg-sand-100 px-6 py-4 text-sm font-medium text-sand-700 hover:bg-sand-200 disabled:opacity-50"
        onClick={onClick}
        disabled={disabled}
      >
        <span>
          {connectorName}
          {isAlreadyActive ? <Icon name="Checkmark" className="ml-2" /> : null}
        </span>
        <span>
          {isLoading ? (
            <Spinner className="!h-10 !w-10" style={{ color: spinnerColor }} />
          ) : ConnectorIcon ? (
            <ConnectorIcon className="h-10 w-10" />
          ) : (
            <Icon name="Wallet" className="!h-10 !w-10" />
          )}
        </span>
      </button>
      {errorMessage ? (
        <div className="mt-1 ml-6 text-sm text-clay-500">{errorMessage}</div>
      ) : null}
    </div>
  );
}
