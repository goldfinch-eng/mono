import { useApolloClient } from "@apollo/client";
import Image from "next/future/image";
import { useForm } from "react-hook-form";
import { useWizard } from "react-use-wizard";

import {
  Button,
  Form,
  InfoIconTooltip,
  useModalContext,
} from "@/components/design-system";
import { UNIQUE_IDENTITY_MINT_PRICE } from "@/constants";
import { dataLayerPushEvent } from "@/lib/analytics";
import { getContract } from "@/lib/contracts";
import { toastTransaction } from "@/lib/toast";
import {
  fetchUniqueIdentitySigner,
  getUIDLabelFromType,
  UIDType,
} from "@/lib/verify";
import { useWallet } from "@/lib/wallet";

import { VerificationFlowSteps } from "../step-manifest";
import { useVerificationFlowContext } from "../verification-flow-context";
import { StepTemplate } from "./step-template";
import uidLogo2 from "./uid-logo2.png";

export function MintStep() {
  const { useModalTitle } = useModalContext();
  useModalTitle("Mint your UID");

  const { signature, uidVersion } = useVerificationFlowContext();
  const { account, provider, signer: walletSigner } = useWallet();
  const apolloClient = useApolloClient();

  const { goToStep } = useWizard();

  const rhfMethods = useForm();
  const handleMint = async () => {
    if (!account || !signature || !provider || !walletSigner) {
      throw new Error("Unable to verify eligibility to mint.");
    }
    const signer = await fetchUniqueIdentitySigner(
      account,
      signature.signature,
      signature.signatureBlockNum
    );

    const uidContract = await getContract({
      name: "UniqueIdentity",
      signer: walletSigner,
    });

    const gasPrice = await provider.getGasPrice();

    const transaction = uidContract.mint(
      signer.idVersion,
      signer.expiresAt,
      signer.signature,
      {
        value: UNIQUE_IDENTITY_MINT_PRICE,
        gasPrice: gasPrice,
      }
    );

    const submittedTransaction = await toastTransaction({
      transaction,
      pendingPrompt: "UID mint submitted.",
      successPrompt: "UID mint succeeded.",
    });

    await apolloClient.refetchQueries({ include: "active" });
    dataLayerPushEvent("UID_MINTED", {
      transactionHash: submittedTransaction.transactionHash,
      uidType: getUIDLabelFromType(signer.idVersion),
    });
    goToStep(VerificationFlowSteps.MintFinished);
  };

  return (
    <StepTemplate
      includePrivacyStatement={false}
      heading="Goldfinch uses UID for identity management"
      headingClassName="font-medium"
      footer={
        <div className="w-full">
          <Form
            rhfMethods={rhfMethods}
            onSubmit={handleMint}
            className="w-full"
          >
            <Button
              type="submit"
              size="lg"
              iconRight="ArrowSmRight"
              className="w-full"
            >
              Mint UID
            </Button>
          </Form>
          <button
            className="m-auto block pt-3 text-center text-sand-500 underline hover:no-underline"
            onClick={() => goToStep(VerificationFlowSteps.MintToAddress)}
          >
            Mint to a smart contract wallet instead
          </button>
        </div>
      }
    >
      <div className="flex h-full flex-col items-center justify-between">
        <div className="text-center">
          <div className="m-auto w-max">
            <Image
              src={uidLogo2}
              width={110}
              height={110}
              quality={100}
              alt="UID"
            />
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
        <div className="text-center text-xs text-sand-400">
          UID is a non-transferrable NFT representing KYC-verification on-chain.
          It follows the ERC-1155 standard, and is freely usable by any other
          protocol. A UID is required to participate in Goldfinch lending pools.
          No personal information is stored on-chain.
        </div>
      </div>
    </StepTemplate>
  );
}
