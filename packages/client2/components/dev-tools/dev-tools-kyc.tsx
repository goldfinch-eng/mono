import { useState } from "react";
import { useForm } from "react-hook-form";

import { Input, Button, Select } from "@/components/design-system";
import { SERVER_URL } from "@/constants";
import { getSignatureForKyc, fetchKycStatus } from "@/lib/verify";
import { useWallet } from "@/lib/wallet";

export default function DevToolsKYC() {
  const [shownData, setShownData] = useState({});
  const [isLoading, setLoading] = useState<boolean>(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors: formErrors },
  } = useForm<{
    countryCode: string;
    residency: "us" | "non-us";
    kycStatus: string;
  }>({
    defaultValues: { kycStatus: "approved" },
  });

  const handleKYCForm = handleSubmit(async (data) => {
    setLoading(true);

    const response = await fetch(`${SERVER_URL}/kycStatus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: account, ...data }),
    });

    setLoading(false);

    if (!response.ok) {
      throw new Error("Could not set KYC status");
    }
    await fetchCurrentKycStatus();
  });

  const { account, provider } = useWallet();

  const fetchCurrentKycStatus = async () => {
    if (!account || !provider) {
      return;
    }
    const signature = await getSignatureForKyc(provider);
    const kycStatus = await fetchKycStatus(
      account,
      signature.signature,
      signature.signatureBlockNum
    );
    setShownData(kycStatus);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Button onClick={fetchCurrentKycStatus}>
          Fetch KYC Data (Signature Required)
        </Button>
        <div>Your current KYC values:</div>
        <pre className="bg-sand-200 p-2">
          {JSON.stringify(shownData, null, 2)}
        </pre>
        <div>Use the form below to change these values.</div>
      </div>
      <form onSubmit={handleKYCForm} className="block w-[760px]">
        <div className="mb-4 flex flex-wrap gap-4">
          <div className="w-64">
            <Input
              label="Country Code"
              inputMode="text"
              {...register("countryCode", {
                required: "Country code is required.",
              })}
              helperText="This represents the country that issued the user's government ID"
              errorMessage={formErrors.countryCode?.message}
            />
          </div>

          <div className="w-64">
            <Input
              label="Residency"
              {...register("residency", {
                validate: (value) =>
                  value !== "us" && value !== "non-us"
                    ? 'Must be "us" or "non-us"'
                    : true,
              })}
              helperText="This represents where the user permanently resides"
              errorMessage={formErrors.residency?.message}
            />
          </div>

          <div className="w-48">
            <Select
              label="KYC Status"
              control={control}
              name="kycStatus"
              options={[
                { value: "approved", label: "approved" },
                { value: "failed", label: "failed" },
                { value: "unknown", label: "unknown" },
              ]}
              helperText="Whether the user is approved or not in Persona"
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
    </div>
  );
}
