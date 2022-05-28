import { useState } from "react";
import { useForm } from "react-hook-form";

import { Input, Button, Select } from "@/components/design-system";
import { SERVER_URL } from "@/constants";

export default function DevToolsKYC({
  account,
}: {
  account: string;
}): JSX.Element {
  const [isLoading, setLoading] = useState<boolean>(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors: formErrors },
  } = useForm<{ countryCode: string; kycStatus: string }>({
    defaultValues: { kycStatus: "approved" },
  });

  const handleKYCForm = handleSubmit(async (data) => {
    setLoading(true);

    await fetch(`${SERVER_URL}/kycStatus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: account, ...data }),
    });

    setLoading(false);
  });

  return (
    <form onSubmit={handleKYCForm} className="block w-[760px]">
      <div className="-mx-2 mb-4 flex pt-4">
        <div className="px-2">
          <Input
            label="Country Code"
            inputMode="text"
            {...register("countryCode", {
              required: "Country code is required.",
            })}
            errorMessage={formErrors.countryCode?.message}
          />
        </div>

        <div className="px-2">
          <Select
            label="KYC Status"
            control={control}
            name="kycStatus"
            options={[
              { value: "approved", label: "approved" },
              { value: "failed", label: "failed" },
              { value: "unknown", label: "unknown" },
            ]}
            errorMessage={formErrors.kycStatus?.message}
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
  );
}
