import { useApolloClient } from "@apollo/client";
import Image from "next/future/image";
import { useEffect, useState } from "react";
import { useWizard } from "react-use-wizard";

import { Button, InfoIconTooltip, Link } from "@/components/design-system";
import { UNIQUE_IDENTITY_MINT_PRICE } from "@/constants";
import { getContract } from "@/lib/contracts";
import { toastTransaction } from "@/lib/toast";
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
import uidLogo2 from "./uid-logo2.png";

interface MintStepProps {
  setTitle?: (title: string) => void;
}

export function MintStep({ setTitle }: MintStepProps) {
  useEffect(() => {
    setTitle && setTitle("Mint your UID");
  });
  const {
    signature,
    mintToAddress,
    uidVersion,
    triggerMintTo,
    setTriggerMintTo,
  } = useVerificationFlowContext();
  const { account, provider } = useWallet();
  const apolloClient = useApolloClient();

  // TODO there's probably a better way to express the local state here
  const [isMinting, setIsMinting] = useState(false);
  const [isMinted, setIsMinted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const { nextStep } = useWizard();

  const handleMint = async () => {
    setIsMinting(true);
    if (!account || !signature || !provider) {
      setErrorMessage("Unable to verify eligibility to mint.");
      return;
    }
    const signer = await fetchUniqueIdentitySigner(
      account,
      signature.signature,
      signature.signatureBlockNum,
      mintToAddress
    );
    try {
      const uidContract = await getContract({
        name: "UniqueIdentity",
        provider,
      });

      const gasPrice = await provider.getGasPrice();

      let transaction;
      if (mintToAddress) {
        transaction = uidContract.mintTo(
          mintToAddress,
          signer.idVersion,
          signer.expiresAt,
          signer.signature,
          {
            value: UNIQUE_IDENTITY_MINT_PRICE,
            gasPrice: gasPrice,
          }
        );
      } else {
        transaction = uidContract.mint(
          signer.idVersion,
          signer.expiresAt,
          signer.signature,
          {
            value: UNIQUE_IDENTITY_MINT_PRICE,
            gasPrice: gasPrice,
          }
        );
      }
      await toastTransaction({
        transaction,
        pendingPrompt: "UID mint submitted.",
        successPrompt: "UID mint succeeded.",
      });
      await apolloClient.refetchQueries({ include: "active" });
      setIsMinted(true);
    } catch (e) {
      console.error(e);
      setErrorMessage("Error while minting");
    } finally {
      setTriggerMintTo(false);
      setIsMinting(false);
    }
  };

  useEffect(() => {
    if (mintToAddress && !isMinting && triggerMintTo) {
      handleMint();
    }
  });

  return (
    <StepTemplate
      includePrivacyStatement={false}
      heading={
        !isMinted
          ? "Goldfinch uses UID for identity management"
          : "Success! You're all set."
      }
      headingClassName="font-medium"
      footer={
        !isMinted ? (
          <div className="w-full">
            <Button
              disabled={isMinting}
              isLoading={isMinting}
              size="lg"
              onClick={handleMint}
              iconRight="ArrowSmRight"
              className="w-full"
            >
              Claim my UID
            </Button>
            <>
              <Link
                href="#"
                style={{ display: "inline-block" }}
                className="w-full pt-3 text-center text-sand-500"
                onClick={nextStep}
              >
                Mint to a smart contract wallet instead
              </Link>
            </>
          </div>
        ) : (
          <ExitFlowButton>Finish</ExitFlowButton>
        )
      }
    >
      <div
        className="flex h-full flex-col items-center justify-between"
        data-id="verfication.step.mint"
      >
        <div>
          {errorMessage ? (
            <div className="mb-8 text-xl text-clay-500">{errorMessage}</div>
          ) : (
            <div className="text-center">
              <div className="relative m-auto w-max">
                <Image
                  src={uidLogo2}
                  width={110}
                  height={110}
                  quality={100}
                  alt="UID"
                />
                {isMinted ? (
                  <Image
                    src={greenCheckmark}
                    width={40}
                    height={40}
                    alt="Minted"
                    className="absolute -top-2 -right-2"
                  />
                ) : null}
              </div>
              <div>
                <div className="font-medium">
                  {uidVersion ? getUIDLabelFromType(uidVersion) : null}
                </div>
                <div className="mb-5 text-sm text-sand-500">
                  {uidVersion === UIDType.USNonAccreditedIndividual ? (
                    <div className="flex items-center justify-center gap-1">
                      Limited participation{" "}
                      <InfoIconTooltip
                        placement="right"
                        content="Limited participation means that you may only participate in governance of the protocol, not lending or borrowing."
                      />
                    </div>
                  ) : (
                    "Full participation"
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="text-center text-xs text-sand-400">
          {!isMinted
            ? "UID is a non-transferrable NFT representing KYC-verification on-chain. It follows the ERC-1155 standard, and is freely usable by any other protocol. A UID is required to participate in Goldfinch lending pools. No personal information is stored on-chain."
            : "With your newly minted UID, you can now participate in all the Goldfinch protocol activities you're eligible for. Get to it!"}
        </div>
      </div>
    </StepTemplate>
  );
}
