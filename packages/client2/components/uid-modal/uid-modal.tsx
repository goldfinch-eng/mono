import Image from "next/image";
import { useEffect, useCallback, useState } from "react";

import { Modal, ModalProps, Button } from "@/components/design-system";
import { KYCModalUID } from "@/components/kyc-modal";
import {
  UNIQUE_IDENTITY_SIGNER_URL,
  UNIQUE_IDENTITY_MINT_PRICE,
} from "@/constants";
import { useUidContract } from "@/lib/contracts";
import {
  getUIDLabelFromType,
  getKYCStatus,
  getUIDType,
  getSignature,
  convertSignatureToAuth,
  asUIDSignatureResponse,
  UIDType,
} from "@/lib/user";
import { useWallet } from "@/lib/wallet";

interface UIDModalProps {
  isOpen: ModalProps["isOpen"];
  onClose: ModalProps["onClose"];
}

export function UIDModal({ isOpen, onClose }: UIDModalProps) {
  const { account, provider } = useWallet();
  const { uidContract } = useUidContract();

  const [uidType, setUidType] = useState<UIDType | null>();
  const [uidLabel, setUidLabel] = useState<string>();
  const [status, setStatus] = useState<string>();

  const setupUIDCallback = useCallback(async () => {
    if (account && isOpen) {
      // Fetch from cache - triggered just before opening modal
      const kycStatus = await getKYCStatus(account);

      // Get UID type
      const type = getUIDType(account, kycStatus);

      if (type !== null) {
        // Get UID label
        const label = getUIDLabelFromType(type);

        setUidType(type);
        setUidLabel(label);
      }
    }
  }, [account, isOpen]);

  useEffect(() => {
    setupUIDCallback();
  }, [setupUIDCallback, isOpen, account]);

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
            <KYCModalUID text={uidLabel} />
          </div>
        </div>
      </div>
      <div className="mt-6 flex w-full items-center">
        {status !== "complete" && (
          <Button
            disabled={!account}
            isLoading={status === "minting"}
            size="lg"
            onClick={async () => {
              if (account && provider && typeof uidType === "number") {
                const signature = await getSignature();

                if (signature) {
                  setStatus("minting");

                  const auth = convertSignatureToAuth(account, signature);

                  const response = await fetch(UNIQUE_IDENTITY_SIGNER_URL, {
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ auth }),
                    method: "POST",
                  });

                  const body = await response.json();

                  const uidSignature = asUIDSignatureResponse(body);

                  const gasPrice = await provider?.getGasPrice();

                  await uidContract?.mint(
                    uidType,
                    uidSignature.expiresAt,
                    uidSignature.signature,
                    {
                      value: UNIQUE_IDENTITY_MINT_PRICE,
                      gasPrice: gasPrice,
                    }
                  );

                  setStatus("complete");
                }
              }
            }}
            className="mx-auto"
            iconRight="ArrowSmRight"
          >
            Claim my UID
          </Button>
        )}

        {status === "complete" && (
          <Button className="mx-auto" size="lg">
            Done
          </Button>
        )}
      </div>
    </Modal>
  );
}
