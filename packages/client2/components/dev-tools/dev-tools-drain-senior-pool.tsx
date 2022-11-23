import { useState } from "react";
import { useForm } from "react-hook-form";

import { SERVER_URL } from "@/constants";

import { Button, Input } from "../design-system";

export default function DevToolsDrainSeniorPool() {
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const {
    register,
    handleSubmit,
    formState: { errors: formErrors },
  } = useForm<{
    usdcAmount: string;
  }>({
    defaultValues: { usdcAmount: "0" },
  });

  const handleForm = handleSubmit(async (data) => {
    setIsLoading(true);

    const response = await fetch(`${SERVER_URL}/drainSeniorPool`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data }),
    });

    setIsLoading(false);

    if (!response.ok) {
      throw new Error("Could not drain senior pool");
    }
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div>
          Specify USDC amount for the SeniorPool to invest in a tranched pool
        </div>
      </div>
      <form onSubmit={handleForm} className="block w-[760px]">
        <div className="mb-4 flex flex-wrap gap-4">
          <div className="w-64">
            <Input
              label="USDC amount (in dollars)"
              inputMode="text"
              {...register("usdcAmount", {
                required: "USDC amount is required.",
              })}
              helperText="This is the amount of USDC you want the senior pool to invest in a tranched pool"
              errorMessage={formErrors.usdcAmount?.message}
            />
          </div>
        </div>

        <Button
          type="submit"
          isLoading={isLoading}
          disabled={isLoading}
          size="lg"
        >
          Submit
        </Button>
      </form>
    </div>
  );
}
