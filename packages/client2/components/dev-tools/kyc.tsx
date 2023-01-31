import { useState } from "react";
import { useForm } from "react-hook-form";

import { Input, Select, Button, Form } from "@/components/design-system";
import { getSignatureForKyc, fetchKycStatus } from "@/lib/verify";
import { useWallet } from "@/lib/wallet";

import { AsyncButton, devserverRequest } from "./helpers";

export function Kyc() {
  const { account, provider } = useWallet();
  const [shownData, setShownData] = useState({});
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

  type FormFields = {
    countryCode: string;
    residency: "us" | "non-us";
    kycStatus: string;
  };
  const rhfMethods = useForm<FormFields>({
    defaultValues: { kycStatus: "approved" },
  });
  const {
    register,
    control,
    formState: { errors: formErrors },
  } = rhfMethods;

  const onSubmit = async (data: FormFields) => {
    const response = await devserverRequest("kycStatus", {
      address: account,
      ...data,
    });
    if (!response.ok) {
      throw new Error("Could not set KYC status");
    }
    await fetchCurrentKycStatus();
  };

  return (
    <div>
      <div className="mb-2 text-2xl font-bold">KYC</div>
      <div className="mb-4 space-y-2">
        <AsyncButton onClick={fetchCurrentKycStatus}>
          Fetch KYC Data (Signature Required)
        </AsyncButton>
        <div>Your current KYC values:</div>
        <pre className="bg-sand-200 p-2">
          {JSON.stringify(shownData, null, 2)}
        </pre>
        <div>
          Use the form below to change these values, this will let you skip
          Persona in the verification flow.
        </div>
      </div>
      <Form
        rhfMethods={rhfMethods}
        onSubmit={onSubmit}
        className="w-max rounded border border-sand-200 p-4"
      >
        <div className="mb-4 flex flex-wrap gap-4">
          <div className="w-64">
            <Input
              label="Country Code"
              inputMode="text"
              {...register("countryCode", {
                required: "Country code is required.",
              })}
              helperText="This represents the country that issued the user's government ID"
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

        <Button type="submit" size="lg">
          Submit
        </Button>
      </Form>
    </div>
  );
}
