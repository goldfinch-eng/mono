import { gql } from "@apollo/client";
import { useAccount, useDisconnect } from "wagmi";

import {
  Button,
  Shimmer,
  HelperText,
  Icon,
  InfoIconTooltip,
  Link,
} from "@/components/design-system";
import { CONTRACT_ADDRESSES, GFI_DECIMALS } from "@/constants";
import { formatCrypto, formatFiat, cryptoToFloat } from "@/lib/format";
import { useCurrentUserWalletInfoQuery } from "@/lib/graphql/generated";
import { getTransactionLabel } from "@/lib/pools";
import { openVerificationModal } from "@/lib/state/actions";
import { reduceOverlappingEventsToNonOverlappingTxs } from "@/lib/tx";
import { getUIDLabelFromGql } from "@/lib/verify";

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
      usdcBalance
      gfiBalance
    }
    user(id: $userAccount) {
      id
      uidType
      isGoListed

      transactions(orderBy: timestamp, orderDirection: desc, first: 5) {
        id
        timestamp
        transactionHash
        category
      }
    }
  }
`;

interface WalletInfoProps {
  onWalletDisconnect: () => void;
}

export function WalletStatus({ onWalletDisconnect }: WalletInfoProps) {
  const { connector } = useAccount();
  const { disconnect } = useDisconnect();
  const { data, loading, error } = useCurrentUserWalletInfoQuery({
    variables: { userAccount: "" }, // leaving this blank because we're using @export in the query to fill in this variable
    fetchPolicy: "network-only", // Always fresh results when this panel is opened
  });
  const viewer = data?.viewer;

  const gfiPrice = data?.gfiPrice.price.amount;
  const gfiBalanceAsFiat =
    viewer?.gfiBalance && gfiPrice
      ? formatFiat({
          symbol: "USD",
          amount: gfiPrice * cryptoToFloat(viewer?.gfiBalance),
        })
      : null;
  const user = data?.user;
  const hasUid = !!user?.uidType;
  const shouldShowVerificationPrompt = !hasUid && !user?.isGoListed;

  const filteredTxs = reduceOverlappingEventsToNonOverlappingTxs(
    user?.transactions
  );

  return (
    <div className="w-80 divide-y divide-sand-100">
      {error ? (
        <HelperText isError>Error while fetching wallet status</HelperText>
      ) : null}

      {!loading && shouldShowVerificationPrompt ? (
        <div className="py-4 first:pt-0">
          <div className="mb-4 text-lg font-semibold">Verify your identity</div>
          <div className="mb-3 text-sm">
            We need to verify your identity and issue a Goldfinch UID to
            participate.
          </div>
          <Button
            variant="rounded"
            size="lg"
            className="block w-full"
            onClick={openVerificationModal}
          >
            Verify identity
          </Button>
        </div>
      ) : null}
      <div className="py-4 first:pt-0">
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
            <div className="text-xs text-sand-500">
              {loading ? (
                <Shimmer style={{ width: "12ch" }} />
              ) : gfiBalanceAsFiat ? (
                gfiBalanceAsFiat
              ) : null}
            </div>
          </div>
        </div>
      </div>
      {!loading && !shouldShowVerificationPrompt ? (
        <div className="py-4">
          <div className="mb-4 text-lg font-semibold">Goldfinch UID type</div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm">
                {user.uidType
                  ? getUIDLabelFromGql(user.uidType)
                  : user.isGoListed
                  ? "Go-listed"
                  : null}
              </div>
              <div className="text-xs text-sand-500">
                {user.uidType === "US_NON_ACCREDITED_INDIVIDUAL"
                  ? "Limited eligibility"
                  : "Full eligibility"}
              </div>
            </div>
            <InfoIconTooltip
              size="sm"
              content={
                user.uidType === "US_NON_ACCREDITED_INDIVIDUAL"
                  ? "Limited eligibility means that you will not be able to participate in loans on Goldfinch, but you may participate in governance."
                  : "You may participate in all aspects of the Goldfinch protocol."
              }
            />
          </div>
          {user.isGoListed && !hasUid ? (
            <div className="mt-4">
              <Button
                className="block w-full"
                variant="rounded"
                size="lg"
                onClick={openVerificationModal}
              >
                Claim UID
              </Button>
              <div className="mt-3 flex items-center gap-2 text-xs text-sand-400">
                <Icon name="Exclamation" size="md" />
                Minting a UID is encouraged (but not required) for go-listed
                users.
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="py-4">
        <div className="mb-4 flex items-start justify-between">
          <div className="text-lg font-semibold">Recent Transactions</div>
          <Link className="text-sm" href="/dashboard#activity">
            View all
          </Link>
        </div>
        <div>
          {filteredTxs.length !== 0 ? (
            <table className="w-full text-sm">
              <tbody>
                {filteredTxs.map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="text-left">
                      {getTransactionLabel(transaction)}
                    </td>
                    <td className="text-right">
                      <Link
                        href={`https://etherscan.io/tx/${transaction.transactionHash}`}
                        iconRight="ArrowTopRight"
                        className="text-sand-400"
                        target="_blank"
                        rel="noopener"
                      >
                        Tx
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-sm text-sand-400">No recent activity</div>
          )}
        </div>
      </div>
      <div className="flex justify-between pt-4">
        <Button
          size="sm"
          colorScheme="secondary"
          onClick={() => {
            disconnect();
            onWalletDisconnect();
          }}
        >
          Disconnect wallet
        </Button>
        <Button
          size="sm"
          colorScheme="secondary"
          disabled={!connector?.watchAsset}
          onClick={() =>
            connector?.watchAsset?.({
              address: CONTRACT_ADDRESSES.GFI,
              symbol: "GFI",
              decimals: GFI_DECIMALS,
              // chose for this to be a data URL so that hosting this icon on different subdomains would not be an issue
              image:
                "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjYiIGhlaWdodD0iMjYiIHZpZXdCb3g9IjAgMCAyNiAyNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTMiIGN5PSIxMyIgcj0iMTIiIGZpbGw9IiNGMUVGRUQiIHN0cm9rZT0iI0Q2RDFDQyIgc3Ryb2tlLXdpZHRoPSIwLjUiLz4KPHBhdGggZD0iTTE2LjI3OTEgOC42NzkwNEMxNi4wMTU5IDguOTY5NzcgMTUuNDA1NiA4Ljk2MzU4IDE1LjE0NTUgOC42OTkxN0MxNC44ODU0IDguNDM0NzYgMTQuODAxIDcuOTI1MjkgMTUuMTUxNSA3LjYwNTgyQzE1LjUwMjEgNy4yODYzNCAxNi4wMjQ2IDcuNDA2NDMgMTYuMjg0OCA3LjY0MTYyQzE2LjU0NTEgNy44NzY4MSAxNi41NDIzIDguMzg4MyAxNi4yNzkxIDguNjc5MDRaIiBmaWxsPSIjNDgzRTVFIi8+CjxwYXRoIGQ9Ik0xMy41NDQ1IDYuNTc2MTFDMTMuMjU3MSA2LjkyNDUzIDEzLjE0NTEgNy4xMjc3OCAxMi45MjY1IDcuNjg0NDhDMTIuNjQzMyA4LjQwNTg5IDEyLjM4NzggOS4yMDI3NyAxMi4yODMxIDkuNjk2MzJDMTIuMTc4NCAxMC4xODk5IDEyLjM3OTIgMTAuNjE1NCAxMi44NDA3IDEwLjkwNzNDMTMuMzI4OSAxMS4yMTYgMTMuODU1NiAxMS40NTcyIDE0LjU2OCAxMS43Mjg4QzE1LjI4MDQgMTIuMDAwNCAxNS43OTA1IDEyLjM4NDggMTUuOTUxNSAxMi43NzY4QzE2LjExMjUgMTMuMTY4OSAxNi4wNzEzIDEzLjkyMiAxNS43MDAyIDE0LjY0MDVDMTUuMzI5MSAxNS4zNTkxIDE0LjgxMzcgMTYuMDI1OSAxMy45MTI2IDE2LjY3OTdDMTMuMDExNiAxNy4zMzM2IDEyLjM5NzcgMTcuNDg2OCAxMS41MDkxIDE3LjY4NzhDMTAuNjIwNSAxNy44ODg4IDEwLjkwOTIgMTguMzk3NyAxMS4yMTQ1IDE4LjUwMjNDMTEuNTE5OSAxOC42MDcgMTIuMTkyNCAxOC43MTM2IDEzLjA5MDEgMTguNjc3NEMxMy45ODc4IDE4LjY0MTIgMTQuODg1NCAxOC40MTk2IDE1Ljk0ODkgMTcuODkwMkMxNy4wMTI1IDE3LjM2MDggMTguMDU3OCAxNi40NDAxIDE4LjYxNjUgMTUuMjA3OEMxOS4xNzUxIDEzLjk3NTYgMTkuNDA0OCAxMi4yMzQgMTguNzcxNCAxMS4xMzIxQzE4LjQwMzQgMTAuNDkxOSAxOC4yMTM5IDEwLjMzNzIgMTguMDkzNyA5LjkzNDI4QzE3Ljk3MzYgOS41MzE0IDE4LjA1MzYgOS4yMjUzNCAxOC4yODMxIDguOTQ3MDdDMTguNDE1NCA4Ljc4NjYzIDE4LjcxMDEgOC42MjU5OSAxOC45ODAzIDguNDMzNDRDMTkuMTkzMiA4LjI4MTY4IDE5LjQ0OTkgOC4xMjk5NyAxOS42MzQxIDguMDA3NDZDMTkuODE4NCA3Ljg4NDk0IDE5Ljg4MTEgNy44MjA3NiAxOS43NTkyIDcuNzM3NzNMMTkuNzU0OCA3LjczNDc2QzE5LjYzMTUgNy42NTA3NSAxOS4zODg0IDcuNDg1MTYgMTguOTY0OCA3LjMyNDM0QzE4LjUzNjIgNy4xNjE2IDE4LjQ1NTQgNy4xMzkwOSAxOC4yOTMyIDcuMTI1MDlDMTguMTMwOSA3LjExMTA5IDE3LjkyNjEgNy4yNTQwOCAxNy41OTg0IDcuNDk5MzNDMTcuMjcwNyA3Ljc0NDU4IDE3LjEyNzcgNy43OTIwNCAxNy4xMDU3IDguMDczMDlDMTcuMDgzOCA4LjM1NDE0IDE3LjAwMDIgOC43MTA3NSAxNi43NzQyIDkuMDE4MzNDMTYuNTQ4MSA5LjMyNTkyIDE2LjI0NjUgOS40ODEwNSAxNS44NDM2IDkuNTE5NjRDMTUuNDQwNiA5LjU1ODIzIDE0Ljg5NjggOS40MzAyNSAxNC42MzA4IDkuMTEyMjFDMTQuMzY0OCA4Ljc5NDE3IDE0LjI1NzkgOC42MTMwMyAxNC4yNjA0IDguMTY0MTJDMTQuMjYyOCA3LjcxNTIxIDE0LjQzNzQgNy4zOTk1MyAxNC42Njg1IDcuMTc0MzNDMTQuODk5NiA2Ljk0OTEzIDE0Ljg4OTEgNi44NjY3MiAxNC44ODk3IDYuNzYzNzhDMTQuODkwMyA2LjY2MDg0IDE0LjgzODggNi4zMTAzOSAxNC43OTUgNi4xNDY5QzE0Ljc1MTIgNS45ODM0MSAxNC41OTEgNS45NTY4MyAxNC4zMjg4IDYuMDQxMzFDMTQuMDU0MiA2LjEyOTc3IDEzLjgzMiA2LjIyNzY5IDEzLjU0NDUgNi41NzYxMVoiIGZpbGw9IiM0ODNFNUUiLz4KPHBhdGggZD0iTTkuNDUzMzggMTUuMTQ2MkM5LjMyMTAyIDE1LjE4MDMgOS4yMjcwOCAxNS40MDY1IDguOTY1MTIgMTUuODU4NkM4LjcwMzE3IDE2LjMxMDcgOC40NTc5MiAxNi42NDA3IDcuOTkwNjggMTcuMTQ0QzcuNTIzNDMgMTcuNjQ3MyA3LjIzMDUyIDE3Ljg1NSA2LjQ4OTE4IDE4LjMwNDRMNi40NzAwNCAxOC4zMTZDNS43NDQxIDE4Ljc1NjEgNS41MzA1OSAxOC44ODU1IDUuNDc5NjUgMTkuMDE5NUM1LjQyODI2IDE5LjE1NDcgNS40NTcwNiAxOS4zMzM0IDUuOTk5NzMgMTkuNDIwMUM2LjU0MjQgMTkuNTA2OSA2Ljk5NTA4IDE5LjUyODIgNy43ODI2NiAxOC45OTE4QzguNTcwMjMgMTguNDU1NCA5LjE4OTU4IDE3LjkzNTUgMTAuMDA0NyAxNy41NTYzQzEwLjgxOTcgMTcuMTc3MSAxMS4wNzQxIDE3LjIwMjYgMTEuOTg2MiAxNi45MzkzQzEyLjg5ODMgMTYuNjc2IDEzLjczMTMgMTYuMTU0MSAxNC4zMDc3IDE1LjUxNzVDMTQuODg0IDE0Ljg4MDggMTUuMTc0IDE0LjIzNzYgMTUuMjkyIDEzLjg3MThDMTUuNDEgMTMuNTA2IDE1LjQyOTIgMTMuMDE3OCAxNS4xMjA3IDEyLjc3MTlDMTQuODI1OSAxMi41MzY5IDE0LjY2NjQgMTIuNDY1OSAxNC4wMTQzIDEyLjIxOEMxMy4zMjA5IDExLjk1NDUgMTMuMDkwNSAxMS44ODgxIDEyLjU4MDggMTEuNDc4M0MxMi4xMDA1IDExLjA5MiAxMi4xMjk2IDExLjAwMDUgMTEuODI2NyAxMC45NTgxQzExLjUyMzggMTAuOTE1NyAxMS4yOTE1IDExLjM2NzkgMTEuMTg3OSAxMS41OTQ0QzExLjExIDExLjc2NDggMTEuMDk1MiAxMi4wNjYzIDExLjI5NzUgMTIuMzUxM0MxMS40OTk3IDEyLjYzNjMgMTEuNjg3NSAxMi45NDk4IDEyLjI0NCAxMy4yNzAxQzEyLjgwMDQgMTMuNTkwMyAxMy4wNjAzIDEzLjY0MjUgMTMuNDQwNSAxMy43MDhDMTMuODIwOCAxMy43NzM2IDEzLjk2ODkgMTMuODY0NSAxMy44NjU2IDE0LjA0NDZDMTMuNzYyMyAxNC4yMjQ3IDEzLjU1NzMgMTQuMzExMiAxMy4yMDk1IDE0LjMwOTNDMTIuODYxNyAxNC4zMDc0IDEyLjM3MTYgMTQuMTQ0NiAxMS44ODIxIDEzLjg1M0MxMS41MzcgMTMuNjQ3MyAxMS4yOTEyIDEzLjQxNjMgMTEuMTEyIDEzLjE4ODNDMTAuOTM3OCAxMi45NjY2IDEwLjgzMjcgMTIuOTM0IDEwLjY3MDEgMTIuOTMzMUMxMC41MDc0IDEyLjkzMjIgMTAuMzczMSAxMy4wMzQ2IDEwLjE3NjkgMTMuMzIyNUM5Ljk4MDc4IDEzLjYxMDQgOS44MzU4MyAxMy45MjI2IDkuODE0NDQgMTQuMDkyQzkuNzkzMDQgMTQuMjYxNCA5Ljc3MzY0IDE0LjQ1MDQgMTAuMDc5MyAxNC42NzkxQzEwLjM4NDkgMTQuOTA3OCAxMC42NDk0IDE1LjAzMjcgMTAuOTk2OCAxNS4wOTY1QzExLjM0NDMgMTUuMTYwNCAxMS42MDgzIDE1LjI3MDUgMTEuMzUyMyAxNS41MDEyQzExLjA5NjMgMTUuNzMxOCAxMC43ODc3IDE1LjY3ODcgMTAuNTQyNiAxNS42MTU1QzEwLjI5NzQgMTUuNTUyMiA5Ljk0MjI1IDE1LjM1ODIgOS44MDc5MyAxNS4yNzAyQzkuNjczNjIgMTUuMTgyMyA5LjU4NTc0IDE1LjExMiA5LjQ1MzM4IDE1LjE0NjJaIiBmaWxsPSIjNDgzRTVFIi8+CjxwYXRoIGQ9Ik0xNy4yMDkxIDcuMDM5MzdDMTcuMzk0MyA2LjkyNTUyIDE3LjU5OTEgNi43NzU4NiAxNy41OTk3IDYuNjcwMzlDMTcuNjAwMyA2LjU2NDkyIDE3LjQ5NzEgNi40Mzc3OCAxNy4wNjIzIDYuMTYxMTVDMTYuNjI3NCA1Ljg4NDUyIDE2LjAyNjYgNS41Njk3NSAxNS42MzIgNS41MjA0MUMxNS4yMzc1IDUuNDcxMDYgMTUuNDA1MSA2LjA5OTM2IDE1LjQ1MDIgNi4zNDc3MUMxNS40OTU0IDYuNTk2MDcgMTUuNTA4MiA2Ljc4OTI5IDE1LjY3MjIgNi44MTAyNkMxNS44MzYxIDYuODMxMjIgMTUuOTU5MSA2Ljg1MTk1IDE2LjEwMjQgNi44OTI4NkMxNi4yNDU3IDYuOTMzNzYgMTYuNDI5OCA3LjAyMTI3IDE2LjYzNDMgNy4xNDI3NUMxNi44Mzg3IDcuMjY0MjIgMTcuMDIzOSA3LjE1MzIyIDE3LjIwOTEgNy4wMzkzN1oiIGZpbGw9IiM0ODNFNUUiLz4KPC9zdmc+Cg==",
            })
          }
        >
          Add GFI to wallet
        </Button>
      </div>
    </div>
  );
}
