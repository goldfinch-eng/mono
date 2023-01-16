import Image from "next/future/image";

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
  const error = coinbaseWalletHooks.useError();
  const handleConnectCoinbaseWallet = () => {
    coinbaseWallet.activate(DESIRED_CHAIN_ID);
  };
  return (
    <ProviderButton
      onClick={handleConnectCoinbaseWallet}
      errorMessage={error?.message}
    >
      {`Coinbase Wallet${isActive ? " (Connected)" : ""}`}
      {isActivating ? (
        <Spinner className="!h-10 !w-10 text-[#3f99fc]" />
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
