import { useApolloClient } from "@apollo/client";
import Image from "next/image";
import { useEffect, useState } from "react";

import { Modal, ModalProps, Button, Spinner } from "@/components/design-system";
import { KYCModalUID } from "@/components/kyc-modal";
import { UNIQUE_IDENTITY_MINT_PRICE } from "@/constants";
import { useUidContract } from "@/lib/contracts";
import { wait } from "@/lib/utils";
import {
  fetchUniqueIdentitySigner,
  getSignatureForKyc,
  getUIDLabelFromType,
} from "@/lib/verify";
import { useWallet } from "@/lib/wallet";

interface UIDModalProps {
  isOpen: ModalProps["isOpen"];
  onClose: ModalProps["onClose"];
}

export function UIDModal({ isOpen, onClose }: UIDModalProps) {
  const { account, provider } = useWallet();
  const { uidContract } = useUidContract();
  const apolloClient = useApolloClient();

  // TODO there's probably a better way to express the local state here
  const [isPolling, setIsPolling] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [isMinted, setIsMinted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [mintingParameters, setMintingParameters] =
    useState<{ id: number; expiresAt: number; signature: string }>();

  useEffect(() => {
    if (provider && account && isOpen) {
      const asyncEffect = async () => {
        setIsPolling(true);
        try {
          const { signature, signatureBlockNum } = await getSignatureForKyc(
            provider
          );

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
                signature,
                signatureBlockNum
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
  }, [provider, account, isOpen]);

  const handleMint = async () => {
    if (!mintingParameters || !uidContract || !provider) {
      return;
    }
    try {
      setIsMinting(true);
      const gasPrice = await provider.getGasPrice();
      const transaction = await uidContract.mint(
        mintingParameters.id,
        mintingParameters.expiresAt,
        mintingParameters.signature,
        {
          value: UNIQUE_IDENTITY_MINT_PRICE,
          gasPrice: gasPrice,
        }
      );
      // TODO index UIDs in subgraph
      await transaction.wait();
      apolloClient.refetchQueries({ include: "active" });
      setIsMinted(true);
    } catch (e) {
      setErrorMessage("Error while minting");
    }
  };

  return (
    <Modal
      size="md"
      title="Verify your identity"
      isOpen={isOpen}
      onClose={onClose}
    >
      <div className="-mx-6 items-center border-y border-sand-200 py-7 px-6">
        <div className="flex w-full">
          <div className="mr-10 flex-1">
            <div className="mt-10 flex w-full flex-col items-center">
              <Image
                src="/content/uid-logo.png"
                width={120}
                height={120}
                alt={"UID"}
              />

              <p className="my-5 text-center">
                Goldfinch uses UID for identity management
              </p>

              <p className="text-center text-xs text-sand-500">
                UID is a non-transferrable NFT representing KYC-verification
                on-chain. It follows the ERC-1155 standard, and is freely usable
                by any other protocol. A UID is required to participate in
                Goldfinch lending pools. No personal information is stored
                on-chain.
              </p>
            </div>
          </div>
          <div className="w-5/12">
            {errorMessage ? (
              <div className="text-clay-500">{errorMessage}</div>
            ) : isPolling ? (
              <div className="flex h-full w-full items-center justify-center">
                <div>
                  <Spinner className="m-auto mb-8 block !h-16 !w-16" />
                  <div className="text-center">
                    Checking your eligibility for minting. This requires a
                    signature.
                  </div>
                </div>
              </div>
            ) : mintingParameters ? (
              <KYCModalUID
                text={getUIDLabelFromType(mintingParameters.id)}
                minted={isMinted}
              />
            ) : null}
          </div>
        </div>
      </div>
      <div className="mt-6 flex w-full items-center justify-end">
        {!isMinted ? (
          <Button
            disabled={!mintingParameters}
            isLoading={isMinting}
            size="lg"
            onClick={handleMint}
            iconRight="ArrowSmRight"
          >
            Claim my UID
          </Button>
        ) : (
          <Button size="lg" onClick={onClose}>
            Done
          </Button>
        )}
      </div>
    </Modal>
  );
}
