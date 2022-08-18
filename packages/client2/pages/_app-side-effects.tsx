import * as Sentry from "@sentry/nextjs";
import { CoinbaseWallet } from "@web3-react/coinbase-wallet";
import { MetaMask } from "@web3-react/metamask";
import { WalletConnect } from "@web3-react/walletconnect";
import { useEffect } from "react";

import { useWallet, connectEagerly } from "@/lib/wallet";

/**
 * Rather contrived React component that just exists to be placed inside the providers above so it gains access to their context (like useWallet()).
 * Kind of cheesy, but ultimately harmless and it does work.
 */
export function AppLevelSideEffects() {
  useEffect(() => {
    connectEagerly();
  }, []);

  const { account, connector } = useWallet();
  useEffect(() => {
    if (account) {
      Sentry.setUser({ id: account });
    }
  }, [account]);

  useEffect(() => {
    if (!connector) {
      return;
    } else if (connector instanceof MetaMask) {
      Sentry.setTag("connector", "MetaMask");
    } else if (connector instanceof WalletConnect) {
      Sentry.setTag("connector", "WalletConnect");
    } else if (connector instanceof CoinbaseWallet) {
      Sentry.setTag("connector", "CoinbaseWallet");
    }
  }, [connector]);

  return null;
}
