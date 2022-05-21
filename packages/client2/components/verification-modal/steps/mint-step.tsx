import { useApolloClient } from "@apollo/client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

import { Button, Link, Spinner } from "@/components/design-system";
import { UNIQUE_IDENTITY_MINT_PRICE } from "@/constants";
import { useUidContract } from "@/lib/contracts";
import { closeVerificationModal } from "@/lib/state/actions";
import { wait, waitForSubgraphBlock } from "@/lib/utils";
import { fetchUniqueIdentitySigner } from "@/lib/verify";
import { useWallet } from "@/lib/wallet";

import { UidPreview } from "../uid-preview";
import { useVerificationFlowContext } from "../verification-flow-context";
import uidLogo from "./uid-logo.png";

export function MintStep() {
  const { signature } = useVerificationFlowContext();
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
      const transaction = await uidContract.mint(
        mintingParameters.id,
        mintingParameters.expiresAt,
        mintingParameters.signature,
        {
          value: UNIQUE_IDENTITY_MINT_PRICE,
          gasPrice: gasPrice,
        }
      );
      const toastId = toast(
        <div>
          UID mint has been submitted, view it on{" "}
          <Link href={`https://etherscan.io/tx/${transaction.hash}`}>
            etherscan.io
          </Link>
        </div>,
        { autoClose: false }
      );
      const receipt = await transaction.wait();
      await waitForSubgraphBlock(receipt.blockNumber);
      toast.update(toastId, {
        render: `UID mint completed`,
        type: "success",
        autoClose: 5000,
      });
      apolloClient.refetchQueries({ include: "active" });
      setIsMinted(true);
    } catch (e) {
      setErrorMessage("Error while minting");
    }
  };

  return (
    <div>
      <div className="-mx-6 items-center border-y border-sand-200 py-7 px-6">
        <div className="flex w-full">
          <div className="mr-10 flex-1">
            <div className="mt-10 flex w-full flex-col items-center">
              <Image src={uidLogo} width={120} height={120} alt="UID" />

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
                    Fetching parameters for minting your UID, this may take a
                    moment.
                  </div>
                </div>
              </div>
            ) : mintingParameters ? (
              <UidPreview minted />
            ) : null}
          </div>
        </div>
      </div>
      <div className="mt-6 flex items-center justify-end">
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
          <Button size="lg" onClick={closeVerificationModal}>
            Done
          </Button>
        )}
      </div>
    </div>
  );
}
