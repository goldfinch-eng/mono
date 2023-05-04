import { format } from "date-fns";
import { useState, useCallback, useEffect, ReactNode } from "react";
import { useForm } from "react-hook-form";
import { useAccount, useProvider } from "wagmi";

import { Button, Form, Input } from "@/components/design-system";

import {
  ButtonLink,
  AsyncButton,
  devserverRequest,
  advanceTimeNDays,
} from "./helpers";

export function Home() {
  const account = useAccount();
  const provider = useProvider();

  const [onChainTimestamp, setOnChainTimestamp] = useState<number>();
  const refreshTimestamp = useCallback(async () => {
    setOnChainTimestamp(undefined);
    const latestBlock = await provider.getBlock("latest");
    setOnChainTimestamp(latestBlock.timestamp);
  }, [provider]);
  useEffect(() => {
    refreshTimestamp();
  }, [refreshTimestamp]);

  const advanceAndRefresh = async (n: number) => {
    await advanceTimeNDays(n);
    await refreshTimestamp();
  };

  return (
    <div>
      <div className="space-y-6">
        <Section title="Advance Time">
          <div className="mb-2 font-medium">
            Current on-chain time:{" "}
            {onChainTimestamp
              ? format(onChainTimestamp * 1000, "HH:mm:ss MMMM dd, yyyy")
              : null}
          </div>
          <div className="flex flex-wrap gap-4">
            <AsyncButton onClick={() => advanceAndRefresh(1)}>
              1 Day
            </AsyncButton>
            <AsyncButton onClick={() => advanceAndRefresh(7)}>
              7 Days
            </AsyncButton>
            <AsyncButton onClick={() => advanceAndRefresh(14)}>
              14 Days
            </AsyncButton>
            <InputAndButton onSubmit={(n) => advanceAndRefresh(n)} />
          </div>
        </Section>
        <Section title="Setup user">
          <div className="flex flex-wrap gap-4">
            <AsyncButton
              onClick={() =>
                devserverRequest("setupCurrentUser", {
                  address: account.address,
                })
              }
              tooltip="You will gain 10 ETH, 250k USDC, and 250k GFI."
              disabled={!account.address}
            >
              Fund and Golist
            </AsyncButton>
            <AsyncButton
              onClick={() =>
                devserverRequest("setupCurrentUser", {
                  address: account.address,
                  fund: true,
                  golist: false,
                })
              }
              disabled={!account.address}
            >
              Fund only
            </AsyncButton>
            <AsyncButton
              onClick={() =>
                devserverRequest("setupCurrentUser", {
                  address: account.address,
                  fund: false,
                  golist: true,
                })
              }
              disabled={!account.address}
            >
              Golist only
            </AsyncButton>
            <AsyncButton
              onClick={() =>
                devserverRequest("setupForTesting", {
                  address: account.address,
                })
              }
              disabled={!account.address}
              tooltip="This will cause you to gain USDC, become go-listed, and also become the borrower on some new tranched pools. You will not gain GFI."
            >
              Legacy setupForTesting
            </AsyncButton>
          </div>
        </Section>
        <Section title="Feature-specific tools">
          <div className="flex flex-wrap gap-2">
            <ButtonLink to="/kyc" colorScheme="tidepool">
              KYC
            </ButtonLink>
            <ButtonLink to="/membership" colorScheme="mustard">
              Membership
            </ButtonLink>
            <ButtonLink to="/withdrawal-mechanics" colorScheme="twilight">
              Withdrawal Mechanics
            </ButtonLink>
            <ButtonLink to="/borrow" colorScheme="sky">
              Borrow
            </ButtonLink>
            <ButtonLink to="/callable-loans" colorScheme="transparent-mustard">
              Callable Loans
            </ButtonLink>
            <ButtonLink to="/community-rewards" colorScheme="mint">
              Community Rewards
            </ButtonLink>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 text-xl font-bold">{title}</div>
      {children}
    </div>
  );
}

function InputAndButton({
  onSubmit,
}: {
  onSubmit: (n: number) => Promise<unknown>;
}) {
  const rhfMethods = useForm<{ n: string }>();
  const s = async (data: { n: string }) => {
    await onSubmit(parseInt(data.n));
  };
  return (
    <Form rhfMethods={rhfMethods} onSubmit={s} className="flex gap-1">
      <Input label="n" hideLabel {...rhfMethods.register("n")} />
      <Button type="submit" size="lg">
        Advance n Days
      </Button>
    </Form>
  );
}
