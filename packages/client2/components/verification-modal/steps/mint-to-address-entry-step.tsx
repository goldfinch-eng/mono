import { useApolloClient } from "@apollo/client";
import Image from "next/future/image";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button, InfoIconTooltip, Input } from "@/components/design-system";
import {
  fetchUniqueIdentitySigner,
  getUIDLabelFromType,
  UIDType,
} from "@/lib/verify";
import { useWallet } from "@/lib/wallet";

import { ExitFlowButton } from "../exit-flow-button";
import { useVerificationFlowContext } from "../verification-flow-context";
import greenCheckmark from "./green-checkmark.png";
import { StepTemplate } from "./step-template";
import { useWizard } from "react-use-wizard";
import { ethers } from "ethers";

interface MintToAddressEntryStepProps {
  setTitle: (title: string) => void;
}

interface MintToAddressForm {
  address: string;
}

export function MintToAddressEntryStep({
  setTitle,
}: MintToAddressEntryStepProps) {
  useEffect(() => {
    setTitle("Enter smart contract wallet address");
  });
  const {
    signature,
    mintingParameters,
    setMintingParameters,
    setMintToAddress,
    setTriggerMintTo,
  } = useVerificationFlowContext();
  const { account, provider } = useWallet();
  const apolloClient = useApolloClient();

  const { previousStep } = useWizard();

  // TODO there's probably a better way to express the local state here
  const formMethods = useForm<MintToAddressForm>();
  const { watch, register } = formMethods;
  const watchedAddress = watch("address");
  const isValidAddress = ethers.utils.isAddress(watchedAddress);

  const setAddressAndGoBack = () => {
    if (!isValidAddress) {
      console.error("Unexpected state, attempting to mint to empty address");
      return;
    }
    setTriggerMintTo(true);
    setMintToAddress(watchedAddress);
    previousStep();
  };

  return (
    <StepTemplate
      includePrivacyStatement={false}
      footer={
        <div className="flex w-full flex-row items-center justify-between">
          <Button size="lg" onClick={previousStep} className="mr-1 w-full">
            Back
          </Button>
          <Button
            size="lg"
            disabled={!isValidAddress}
            onClick={setAddressAndGoBack}
            iconRight="ArrowSmRight"
            className="ml-1 w-full"
          >
            Mint UID
          </Button>
        </div>
      }
    >
      <div
        className="flex h-full flex-col items-center justify-between"
        data-id="verfication.step.mint-to"
      >
        <Input
          required={true}
          {...register("address", { required: "Required" })}
          label="Smart contract wallet address"
          labelDecoration={
            <InfoIconTooltip
              size="sm"
              placement="top"
              content="Your full name as it appears on your government-issued identification. This should be the same as your full legal name used to register your UID."
            />
          }
          placeholder="0x...1234"
          textSize="sm"
          className="mb-3 w-full"
          labelClassName="!text-sm !mb-3"
        />{" "}
        <div className="mt-8 text-xs text-sand-500">
          Please note this wallet will be able to interact with the Goldfinch
          protocol on behalf of you or the organization that went through
          verification. You are not approving the wallet to move any of your
          funds whatsoever. This is merely minting a UID to that address, the
          same as if you minted it to a personal wallet. You have ultimate
          control over this UID, and it can be revoked from this smart contract
          by contacting Warbler Labs.
        </div>
      </div>
    </StepTemplate>
  );
}
