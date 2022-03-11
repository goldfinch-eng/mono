import { gql } from "@apollo/client";

import { Button } from "@/components/button";
import { Shimmer } from "@/components/spinners";
import { useCurrentUserWalletInfoQuery } from "@/lib/graphql/generated";
import { useWallet } from "@/lib/wallet";

gql`
  query CurrentUserWalletInfo {
    currentUser @client {
      account
      usdcBalance
    }
  }
`;

export function WalletInfo() {
  const { connector } = useWallet();
  const { data } = useCurrentUserWalletInfoQuery();
  const account = data?.currentUser.account;
  const usdcBalance = data?.currentUser.usdcBalance
    ? new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
      }).format(data.currentUser.usdcBalance)
    : undefined;

  return (
    <div className="space-y-2">
      <div>
        <div className="font-bold">Wallet address</div>
        <div>{account ?? <Shimmer style={{ width: "42ch" }} />}</div>
      </div>
      <div>
        <div className="font-bold">USDC Balance</div>
        <div>{usdcBalance ?? <Shimmer />}</div>
      </div>
      <div className="flex justify-end">
        <Button colorScheme="sand" onClick={() => connector.deactivate()}>
          Disconnect Wallet
        </Button>
      </div>
    </div>
  );
}
