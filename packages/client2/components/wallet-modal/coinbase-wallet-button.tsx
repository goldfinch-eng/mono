import Image from "next/image";

import { Spinner } from "@/components/design-system";
import { DESIRED_CHAIN_ID } from "@/constants";
import {
  coinbaseWallet,
  coinbaseWalletHooks,
} from "@/lib/wallet/connectors/coinbase-wallet";

import coinbaseWalletLogo from "./coinbase-wallet-logo.png";
import { ProviderButton } from "./provider-button";

export function CoinbaseWalletButton() {
  const isActive = coinbaseWalletHooks.useIsActive();
  const isActivating = coinbaseWalletHooks.useIsActivating();
  const handleConnectCoinbaseWallet = () => {
    coinbaseWallet.activate(DESIRED_CHAIN_ID);
  };
  return (
    <ProviderButton
      disabled={isActive || isActivating}
      onClick={handleConnectCoinbaseWallet}
    >
      {`Coinbase Wallet${isActive ? " (Connected)" : ""}`}
      {isActivating ? (
        <Spinner className="!h-10 !w-10 text-[#f6851b]" />
      ) : (
        <Image
          src={coinbaseWalletLogo}
          width={40}
          height={40}
          alt="Coinbase Wallet"
        />
      )}
    </ProviderButton>
  );
}
