import { format } from "date-fns";
import { useState, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";

import { SERVER_URL } from "@/constants";
import { getFreshProvider } from "@/lib/wallet";

import { Button, Form, Input } from "../design-system";
import { ButtonLink, Link } from "./helpers";
import { AsyncButton } from "./helpers/async-button";

export function Home() {
  const [onChainTimestamp, setOnChainTimestamp] = useState<number>();
  const refreshTimestamp = useCallback(async () => {
    // have to get a new provider every time this is called because otherwise the result for latestBlock is cached
    const uncachedProvider = getFreshProvider();
    setOnChainTimestamp(undefined);
    const latestBlock = await uncachedProvider.getBlock("latest");
    setOnChainTimestamp(latestBlock.timestamp);
  }, []);
  useEffect(() => {
    refreshTimestamp();
  }, [refreshTimestamp]);

  const advanceTime = async (n: number) => {
    const response = await fetch(`${SERVER_URL}/advanceTimeNDays`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ n }),
    });
    if (!response.ok) {
      throw new Error(await response.json().then((json) => json.message));
    }
    await refreshTimestamp();
  };

  return (
    <div>
      <div className="font-bold">
        Current on-chain time:{" "}
        {onChainTimestamp
          ? format(onChainTimestamp * 1000, "HH:mm:ss MMMM dd, yyyy")
          : null}
      </div>
      <div className="mb-2 text-xl font-bold">Advance Time</div>
      <div className="flex flex-wrap gap-4">
        <AsyncButton onClick={() => advanceTime(1)}>1 Day</AsyncButton>
        <AsyncButton onClick={() => advanceTime(7)}>7 Days</AsyncButton>
        <AsyncButton onClick={() => advanceTime(14)}>14 Days</AsyncButton>
        <InputAndButton onSubmit={(n) => advanceTime(n)} />
      </div>
      <Link to="/membership">Go to membership tools</Link>
      <ButtonLink to="/membership">Membership</ButtonLink>
    </div>
  );
}

function InputAndButton({
  onSubmit,
}: {
  onSubmit: (n: number) => Promise<void>;
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
