import { useApolloClient } from "@apollo/client";
import { format } from "date-fns";
import { BigNumber } from "ethers";
import { ReactNode, useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { Button, Drawer, DrawerProps, Form } from "@/components/design-system";
import { SERVER_URL } from "@/constants";
import { getContract } from "@/lib/contracts";
import { formatCrypto } from "@/lib/format";
import { SupportedCrypto } from "@/lib/graphql/generated";
import { toastTransaction } from "@/lib/toast";
import { useWallet } from "@/lib/wallet";

export function MembershipDevToolDrawer(
  props: Omit<DrawerProps, "children" | "title" | "from">
) {
  const { account, provider } = useWallet();
  const apolloClient = useApolloClient();
  const [onChainTimestamp, setOnChainTimestamp] = useState<number>();
  const refreshTimestamp = useCallback(async () => {
    if (!provider) {
      return;
    }
    const latestBlock = await provider.getBlock("latest");
    setOnChainTimestamp(latestBlock.timestamp);
  }, [provider]);
  useEffect(() => {
    refreshTimestamp();
  }, [refreshTimestamp, props.isOpen]);
  return (
    <Drawer {...props} title="Membership Dev Tools" from="bottom">
      <div className="mb-2 text-lg">
        <div>
          This area contains dev tools that are specifically geared for testing
          Membership Vaults
        </div>
        <div className="font-bold">
          Current on-chain time:{" "}
          {onChainTimestamp
            ? format(onChainTimestamp * 1000, "MMMM dd, yyyy")
            : null}
        </div>
      </div>

      <div className="flex gap-5">
        <ToolButton
          handler={async () => {
            await fetch(`${SERVER_URL}/setupForTestingLite`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                address: account,
              }),
            });
          }}
        >
          Become go listed and funded
        </ToolButton>
        <ToolButton
          handler={async () => {
            for (let i = 0; i < 7; i++) {
              const advanceTimeResponse = await fetch(
                `${SERVER_URL}/advanceTimeOneDay`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                }
              );
              if (!advanceTimeResponse.ok) {
                throw new Error("Could not advance time.");
              }
            }
            await new Promise((resolve) => setTimeout(resolve, 1000));
            refreshTimestamp();
          }}
        >
          Advance time 7 days
        </ToolButton>
        <ToolButton
          handler={async () => {
            if (!account || !provider) {
              throw new Error("Wallet not connected");
            }
            const usdcContract = await getContract({ name: "USDC", provider });
            const erc20SplitterContract = await getContract({
              name: "ERC20Splitter",
              provider,
            });
            const usdcToSend = {
              token: SupportedCrypto.Usdc,
              amount: BigNumber.from("10000000000"),
            };

            await toastTransaction({
              transaction: usdcContract.transfer(
                erc20SplitterContract.address,
                usdcToSend.amount
              ),
              pendingPrompt: `Sending ${formatCrypto(
                usdcToSend
              )} to ERC20 Splitter.`,
              successPrompt: `Sent ${formatCrypto(
                usdcToSend
              )} to ERC20 Splitter.`,
            });
            await toastTransaction({
              transaction: erc20SplitterContract.distribute(),
              pendingPrompt: "Finalizing epoch",
            });
            await apolloClient.refetchQueries({ include: "active" });
          }}
        >
          Send money to splitter and distribute
        </ToolButton>
      </div>
    </Drawer>
  );
}

function ToolButton({
  handler,
  children,
}: {
  handler: () => void;
  children: ReactNode;
}) {
  const rhfMethods = useForm();
  return (
    <Form rhfMethods={rhfMethods} onSubmit={handler}>
      <Button type="submit" size="lg">
        {children}
      </Button>
    </Form>
  );
}
