import { gql } from "@apollo/client";

import { Button, Shimmer, HelperText, Icon } from "@/components/design-system";
import { formatCrypto, formatFiat, cryptoToFloat } from "@/lib/format";
import {
  SupportedFiat,
  useCurrentUserWalletInfoQuery,
} from "@/lib/graphql/generated";
import { openVerificationModal } from "@/lib/state/actions";
import { useWallet } from "@/lib/wallet";

gql`
  query CurrentUserWalletInfo($userAccount: ID!) {
    gfiPrice(fiat: USD) @client {
      price {
        amount
        symbol
      }
    }
    viewer @client {
      account(format: "lowercase") @export(as: "userAccount")
      usdcBalance {
        token
        amount
      }
      gfiBalance {
        token
        amount
      }
      isGoListed
    }
    user(id: $userAccount) {
      id
      isUsEntity
      isNonUsEntity
      isUsAccreditedIndividual
      isUsNonAccreditedIndividual
      isNonUsIndividual
    }
  }
`;

interface WalletInfoProps {
  onWalletDisconnect: () => void;
}

export function WalletStatus({ onWalletDisconnect }: WalletInfoProps) {
  const { connector } = useWallet();
  const { data, loading, error } = useCurrentUserWalletInfoQuery({
    variables: { userAccount: "" }, // leaving this blank because we're using @export in the query to fill in this variable
    fetchPolicy: "network-only", // Always fresh results when this panel is opened
  });
  const viewer = data?.viewer;

  const gfiPrice = data?.gfiPrice.price.amount;
  const gfiBalanceAsFiat =
    viewer?.gfiBalance && gfiPrice
      ? formatFiat({
          symbol: SupportedFiat.Usd,
          amount: gfiPrice * cryptoToFloat(viewer?.gfiBalance),
        })
      : null;

  return (
    <div className="min-w-[320px] space-y-8">
      {error ? (
        <HelperText isError>Error while fetching wallet status</HelperText>
      ) : null}
      <div>
        <div className="mb-4 text-lg font-semibold">Balances</div>
        <div className="mb-6 flex items-center justify-between">
          <div className="flex gap-2">
            <Icon name="Usdc" size="md" />
            <span className="font-medium">USDC</span>
          </div>
          <div className="text-right">
            <div>
              {loading ? (
                <Shimmer style={{ width: "12ch" }} />
              ) : viewer?.usdcBalance ? (
                formatCrypto(viewer.usdcBalance)
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Icon name="Gfi" size="md" />
            <span className="font-medium">GFI</span>
          </div>
          <div className="text-right">
            <div>
              {loading ? (
                <Shimmer style={{ width: "12ch" }} />
              ) : viewer?.gfiBalance ? (
                formatCrypto(viewer.gfiBalance)
              ) : null}
            </div>
            <div className="text-xs">
              {loading ? (
                <Shimmer style={{ width: "12ch" }} />
              ) : gfiBalanceAsFiat ? (
                gfiBalanceAsFiat
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <div>
        <div className="mb-4 text-lg font-semibold">Your UID</div>
        <div>
          {loading ? (
            <Shimmer style={{ width: "20ch" }} />
          ) : data?.user?.isNonUsEntity ? (
            "You are a non-US entity"
          ) : data?.user?.isNonUsIndividual ? (
            "You are a non-US individual"
          ) : data?.user?.isUsAccreditedIndividual ? (
            "You are a US accredited individual"
          ) : data?.user?.isUsEntity ? (
            "You are a US entity"
          ) : data?.user?.isUsNonAccreditedIndividual ? (
            "You are a US non-accredited individual"
          ) : viewer?.isGoListed ? (
            <>
              <div>You are go listed (no UID required)</div>
              <div>
                <Button onClick={openVerificationModal}>Verify anyway</Button>
              </div>
            </>
          ) : (
            <>
              <div>You do not have a UID yet</div>
              <div>
                <Button onClick={openVerificationModal}>
                  Verify your identity
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
      <div>
        <div className="mb-4 text-lg font-semibold">Recent Transactions</div>
        <div>TODO</div>
      </div>
      <div className="text-center">
        <Button
          colorScheme="secondary"
          size="sm"
          onClick={() => {
            connector.deactivate();
            onWalletDisconnect();
          }}
        >
          Disconnect Wallet
        </Button>
      </div>
    </div>
  );
}
