import { useApolloClient } from "@apollo/client";
import Image from "next/image";
import { useEffect, useState } from "react";

import { Button, InfoIconTooltip, Spinner } from "@/components/design-system";
import { UNIQUE_IDENTITY_MINT_PRICE } from "@/constants";
import { useContract } from "@/lib/contracts";
import { closeVerificationModal } from "@/lib/state/actions";
import { toastTransaction } from "@/lib/toast";
import { wait } from "@/lib/utils";
import {
  fetchUniqueIdentitySigner,
  getUIDLabelFromType,
  UIDType,
} from "@/lib/verify";
import { useWallet } from "@/lib/wallet";

import { useVerificationFlowContext } from "../verification-flow-context";
import greenCheckmark from "./green-checkmark.png";
import { StepTemplate } from "./step-template";
import uidLogo2 from "./uid-logo2.png";

export function MintStep() {
  const { signature } = useVerificationFlowContext();
  const { account, provider } = useWallet();
  const uidContract = useContract("UniqueIdentity");
  const apolloClient = useApolloClient();

  // TODO there's probably a better way to express the local state here
  const [isPolling, setIsPolling] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [isMinted, setIsMinted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [mintingParameters, setMintingParameters] =
    useState<{ id: number; expiresAt: number; signature: string }>();

  useEffect(() => {
    if (provider && account && signature) {
      const asyncEffect = async () => {
        setIsPolling(true);
        try {
          let signer: Awaited<
            ReturnType<typeof fetchUniqueIdentitySigner>
          > | null = null;
          let numAttempts = 0;
          const maxPollAttempts = 10;
          while (numAttempts < maxPollAttempts) {
            numAttempts += 1;
            try {
              signer = await fetchUniqueIdentitySigner(
                account,
                signature.signature,
                signature.signatureBlockNum
              );
              setMintingParameters({
                id: signer.idVersion,
                expiresAt: signer.expiresAt,
                signature: signer.signature,
              });
              break;
            } catch (e) {
              await wait(5000);
              continue;
            }
          }
          setIsPolling(false);
          if (numAttempts === maxPollAttempts) {
            setErrorMessage("Unable to verify eligibility to mint.");
          }
        } catch (e) {
          setIsPolling(false);
          setErrorMessage((e as Error).message);
        }
      };
      asyncEffect();
    } else {
      setIsPolling(false);
      setErrorMessage(undefined);
      setMintingParameters(undefined);
      setIsMinting(false);
      setIsMinted(false);
    }
  }, [provider, account, signature]);

  const handleMint = async () => {
    if (!mintingParameters || !uidContract || !provider) {
      return;
    }
    try {
      setIsMinting(true);
      const gasPrice = await provider.getGasPrice();
      const transaction = uidContract.mint(
        mintingParameters.id,
        mintingParameters.expiresAt,
        mintingParameters.signature,
        {
          value: UNIQUE_IDENTITY_MINT_PRICE,
          gasPrice: gasPrice,
        }
      );
      await toastTransaction({
        transaction,
        pendingPrompt: "UID mint submitted.",
        successPrompt: "UID mint succeeded.",
      });
      await apolloClient.refetchQueries({ include: "active" });
      setIsMinted(true);
    } catch (e) {
      setIsMinting(false);
      setErrorMessage("Error while minting");
    }
  };

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
          <Button
            disabled={!mintingParameters}
            isLoading={isMinting}
            size="lg"
            onClick={handleMint}
            iconRight="ArrowSmRight"
            className="w-full"
          >
            Claim my UID
          </Button>
        ) : (
          <Button size="lg" onClick={closeVerificationModal} className="w-full">
            Finish
          </Button>
        )
      }
    >
      <div className="flex h-full flex-col items-center justify-between">
        <div>
          {errorMessage ? (
            <div className="text-clay-500">{errorMessage}</div>
          ) : isPolling ? (
            <div>
              <div className="mb-8">
                <Spinner className="m-auto block !h-20 !w-20" />
              </div>
              <div className="text-center">
                Fetching data for minting your UID, this may take a moment.
              </div>
            </div>
          ) : mintingParameters ? (
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
                  <div className="absolute -top-2 -right-2">
                    <Image
                      src={greenCheckmark}
                      width={40}
                      height={40}
                      alt="Minted"
                    />
                  </div>
                ) : null}
              </div>
              <div>
                <div className="font-medium">
                  {getUIDLabelFromType(mintingParameters.id)}
                </div>
                <div className="mb-5 text-sm text-sand-500">
                  {mintingParameters.id ===
                  UIDType.USNonAccreditedIndividual ? (
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
          ) : null}
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
