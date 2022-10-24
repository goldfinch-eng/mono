import { BigNumber } from "ethers";
import { useState, useEffect } from "react";

import { Button, Modal } from "@/components/design-system";
import { formatCrypto } from "@/lib/format";
import { SupportedCrypto } from "@/lib/graphql/generated";
import { gfiToUsdc } from "@/lib/pools";

import { SectionHeading } from "./add-to-vault";
import { AssetCheckbox, GfiBox } from "./asset-box";

type VaultedGfi = {
  positionId: string;
  amount: BigNumber;
};

type VaultedStakedPosition = {
  positionId: string;
  usdcEquivalent: BigNumber;
  seniorPoolStakedPosition: {
    id: string;
    amount: BigNumber; // FIDU
  };
};

type VaultedPoolToken = {
  positionId: string;
  usdcEquivalent: BigNumber;
  poolToken: {
    id: string;
    tranchedPool: {
      id: string;
      name: string;
    };
  };
};

interface RemoveFromVaultProps {
  isOpen: boolean;
  onClose: () => void;
  vaultedGfi: VaultedGfi;
  fiatPerGfi: number;
  vaultedStakedPositions: VaultedStakedPosition[];
  vaultedPoolTokens: VaultedPoolToken[];
}

export function RemoveFromVault({
  isOpen,
  onClose,
  vaultedGfi,
  fiatPerGfi,
  vaultedStakedPositions,
  vaultedPoolTokens,
}: RemoveFromVaultProps) {
  const [gfiToUnvault, setGfiToUnvault] = useState("0");
  const [step, setStep] = useState<"select" | "review">("select");
  const [stakedPositionsToUnvault, setStakedPositionsToUnvault] = useState<
    VaultedStakedPosition[]
  >([]);
  const [poolTokensToUnvault, setPoolTokensToUnvault] = useState<
    VaultedPoolToken[]
  >([]);

  useEffect(() => {
    if (!isOpen) {
      setStep("select");
      setGfiToUnvault("0");
      setStakedPositionsToUnvault([]);
      setPoolTokensToUnvault([]);
    }
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="bg-mustard-300"
      title="Select assets to remove"
      divider={false}
    >
      <div className={step === "select" ? undefined : "hidden"}>
        <div className="mb-8">
          <SectionHeading
            leftText="Step 1: Choose an amount of GFI"
            rightText={formatCrypto({
              token: SupportedCrypto.Gfi,
              amount: vaultedGfi.amount,
            })}
          />
          <GfiBox
            max={{ token: SupportedCrypto.Gfi, amount: vaultedGfi.amount }}
            maxInUsdc={gfiToUsdc(
              {
                token: SupportedCrypto.Gfi,
                amount: vaultedGfi.amount,
              },
              fiatPerGfi
            )}
            fiatPerGfi={fiatPerGfi}
            onChange={(s) => setGfiToUnvault(s)}
          />
        </div>
        <div className="mb-8">
          <SectionHeading leftText="Step 2: Choose an amount of capital" />
          <div className="space-y-2">
            {vaultedStakedPositions.map((vsp) => {
              const checked = stakedPositionsToUnvault.some(
                (v) => v.positionId === vsp.positionId
              );
              return (
                <AssetCheckbox
                  key={vsp.positionId}
                  checked={checked}
                  onChange={() => {
                    if (!checked) {
                      setStakedPositionsToUnvault([
                        ...stakedPositionsToUnvault,
                        vsp,
                      ]);
                    } else {
                      setStakedPositionsToUnvault(
                        removeFromListByPositionId(
                          stakedPositionsToUnvault,
                          vsp.positionId
                        )
                      );
                    }
                  }}
                  asset={{
                    name: "Staked FIDU",
                    description: "Goldfinch Senior Pool Position",
                    nativeAmount: {
                      token: SupportedCrypto.Fidu,
                      amount: vsp.seniorPoolStakedPosition.amount,
                    },
                    usdcAmount: {
                      token: SupportedCrypto.Usdc,
                      amount: vsp.usdcEquivalent,
                    },
                  }}
                />
              );
            })}
            {vaultedPoolTokens.map((vpt) => {
              const checked = poolTokensToUnvault.some(
                (v) => v.positionId === vpt.positionId
              );
              return (
                <AssetCheckbox
                  key={vpt.positionId}
                  checked={checked}
                  onChange={() => {
                    if (!checked) {
                      setPoolTokensToUnvault([...poolTokensToUnvault, vpt]);
                    } else {
                      setPoolTokensToUnvault(
                        removeFromListByPositionId(
                          poolTokensToUnvault,
                          vpt.positionId
                        )
                      );
                    }
                  }}
                  asset={{
                    name: "Borrower Pool Position",
                    description: vpt.poolToken.tranchedPool.name,
                    usdcAmount: {
                      token: SupportedCrypto.Usdc,
                      amount: vpt.usdcEquivalent,
                    },
                  }}
                />
              );
            })}
          </div>
        </div>
        <div className="mb-8">
          <SectionHeading leftText="Vault earnings" />
        </div>
      </div>
      <Button
        onClick={() =>
          alert(
            `Confirming with GFI ${gfiToUnvault} staked positions ${stakedPositionsToUnvault
              .map((s) => s.positionId)
              .join(", ")}, pool tokens ${poolTokensToUnvault
              .map((p) => p.positionId)
              .join(", ")}`
          )
        }
      >
        aaa
      </Button>
    </Modal>
  );
}

function removeFromListByPositionId<T extends { positionId: string }>(
  list: T[],
  idToRemove: string
): T[] {
  return list.filter((item) => item.positionId !== idToRemove);
}
