import { gql } from "@apollo/client";
import * as Sentry from "@sentry/nextjs";
import { CoinbaseWallet } from "@web3-react/coinbase-wallet";
import { MetaMask } from "@web3-react/metamask";
import { WalletConnect } from "@web3-react/walletconnect";
import { useEffect } from "react";

import { dataLayerPushEvent } from "@/lib/analytics";
import { useUserUidForAnalyticsQuery } from "@/lib/graphql/generated";
import { getUIDLabelFromGql } from "@/lib/verify";
import { useWallet, connectEagerly } from "@/lib/wallet";

gql`
  query UserUidForAnalytics($account: ID!) {
    user(id: $account) {
      id
      uidType
    }
  }
`;

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
      dataLayerPushEvent("WALLET_CONNECTED", { account });
    }
  }, [account]);

  const { data } = useUserUidForAnalyticsQuery({
    variables: { account: account?.toLowerCase() ?? "" },
    skip: !account,
  });

  useEffect(() => {
    if (data?.user) {
      if (!data.user.uidType) {
        return;
      }
      const uidLabel = getUIDLabelFromGql(data.user.uidType);
      dataLayerPushEvent("UID_LOADED", { uidType: uidLabel });
    }
  }, [data]);

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
