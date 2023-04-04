import { gql } from "@apollo/client";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { useAccount } from "wagmi";

import { dataLayerPushEvent } from "@/lib/analytics";
import { useUserUidForAnalyticsQuery } from "@/lib/graphql/generated";
import { getUIDLabelFromGql } from "@/lib/verify";

gql`
  query UserUidForAnalytics($account: ID!) {
    user(id: $account) {
      id
      isUsEntity
      isNonUsEntity
      isUsAccreditedIndividual
      isUsNonAccreditedIndividual
      isNonUsIndividual
    }
  }
`;

/**
 * Rather contrived React component that just exists to be placed inside the providers above so it gains access to their context (like useWallet()).
 * Kind of cheesy, but ultimately harmless and it does work.
 */
export function AppLevelSideEffects() {
  const { address: account, connector } = useAccount();
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
      const uidLabel = getUIDLabelFromGql(data.user);
      if (!uidLabel) {
        return;
      }
      dataLayerPushEvent("UID_LOADED", { uidType: uidLabel });
    }
  }, [data]);

  useEffect(() => {
    if (!connector) {
      return;
    } else if (connector.id === "metaMask") {
      Sentry.setTag("connector", "MetaMask");
    } else if (
      connector.id === "walletConnect" ||
      connector.id === "walletConnectLegacy"
    ) {
      Sentry.setTag("connector", "WalletConnect");
    } else if (connector.id === "coinbaseWallet") {
      Sentry.setTag("connector", "CoinbaseWallet");
    }
  }, [connector]);

  return null;
}
