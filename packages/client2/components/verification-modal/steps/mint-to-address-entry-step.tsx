import { ethers } from "ethers";
import { useForm } from "react-hook-form";
import { useWizard } from "react-use-wizard";

import {
  Button,
  Form,
  Input,
  useModalContext,
} from "@/components/design-system";

import { useVerificationFlowContext } from "../verification-flow-context";
import { StepTemplate } from "./step-template";

interface MintToAddressForm {
  address: string;
}

export function MintToAddressEntryStep() {
  const { useModalTitle } = useModalContext();
  useModalTitle("Enter smart contract wallet address");

  const { setMintToAddress, setTriggerMintTo } = useVerificationFlowContext();

  const { previousStep } = useWizard();

  const rhfMethods = useForm<MintToAddressForm>();
  const { register } = rhfMethods;
  const onSubmit = (data: MintToAddressForm) => {
    setTriggerMintTo(true);
    setMintToAddress(data.address);
    previousStep();
  };

  const validate = (address: string) => {
    if (!ethers.utils.isAddress(address)) {
      return "Not a valid address";
    }
  };

  return (
    <Form
      rhfMethods={rhfMethods}
      onSubmit={onSubmit}
      className="flex h-full grow flex-col justify-between"
    >
      <StepTemplate
        includePrivacyStatement={false}
        footer={
          <div className="flex w-full flex-row items-center justify-between gap-2">
            <Button size="lg" onClick={previousStep} className="w-full">
              Back
            </Button>
            <Button
              size="lg"
              type="submit"
              iconRight="ArrowSmRight"
              className="w-full"
            >
              Mint UID
            </Button>
          </div>
        }
      >
        <Input
          {...register("address", { required: "Required", validate })}
          label="Smart contract wallet address"
          placeholder="0x...1234"
          textSize="sm"
          className="mb-3 w-full"
          labelClassName="!text-sm !mb-3"
        />

        <div className="mt-8 text-xs text-sand-500">
          Please note this wallet will be able to interact with the Goldfinch
          protocol on behalf of you or the organization that went through
          verification. You are not approving the wallet to move any of your
          funds whatsoever. This is merely minting a UID to that address, the
          same as if you minted it to a personal wallet. You have ultimate
          control over this UID, and it can be revoked from this smart contract
          by contacting Warbler Labs.
        </div>
      </StepTemplate>
    </Form>
  );
}
