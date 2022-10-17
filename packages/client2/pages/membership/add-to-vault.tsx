import { gql } from "@apollo/client";
import { BigNumber } from "ethers";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import {
  Button,
  Checkbox,
  DollarInput,
  InfoIconTooltip,
  Modal,
  ModalProps,
} from "@/components/design-system";
import { formatCrypto } from "@/lib/format";
import {
  CryptoAmount,
  MembershipPageQuery,
  SupportedCrypto,
} from "@/lib/graphql/generated";
import { gfiToUsdc, sharesToUsdc, sum } from "@/lib/pools";

type StakedPosition = MembershipPageQuery["seniorPoolStakedPositions"][number];
type PoolToken = MembershipPageQuery["tranchedPoolTokens"][number];

export const ADD_TO_VAULT_POOL_TOKEN_FIELDS = gql`
  fragment AddToVaultPoolTokenFields on TranchedPoolToken {
    id
    principalAmount
    tranchedPool {
      id
      name @client
    }
  }
`;

interface AddToVaultProps extends Omit<ModalProps, "children" | "title"> {
  maxVaultableGfi: CryptoAmount;
  fiatPerGfi: number;
  vaultableStakedPositions: StakedPosition[];
  sharePrice: BigNumber;
  vaultablePoolTokens: PoolToken[];
}

export function AddToVault({
  maxVaultableGfi,
  fiatPerGfi,
  vaultableStakedPositions,
  sharePrice,
  vaultablePoolTokens,
  ...rest
}: AddToVaultProps) {
  const gfiInUsdc = gfiToUsdc(maxVaultableGfi, fiatPerGfi);
  const total = {
    token: SupportedCrypto.Usdc,
    amount: gfiInUsdc.amount
      .add(
        sharesToUsdc(sum("amount", vaultableStakedPositions), sharePrice).amount
      )
      .add(sum("principalAmount", vaultablePoolTokens)),
  };
  const [gfiToVault, setGfiToVault] = useState("");
  const [stakedPositionsToVault, setStakedPositionsToVault] = useState<
    StakedPosition[]
  >([]);
  const [poolTokensToVault, setPoolTokensToVault] = useState<PoolToken[]>([]);

  return (
    <Modal {...rest} className="bg-sand-100" title="Add to vault" size="sm">
      <div className="mb-2 mt-4 flex justify-between gap-3 text-lg font-semibold">
        <div>Available assets</div>
        <div>{formatCrypto(total)}</div>
      </div>
      <div className="mb-8 space-y-2">
        {!maxVaultableGfi.amount.isZero() ? (
          <AssetCheckbox
            name="GFI"
            tooltip="Lorem ipsum"
            description="Goldfinch Token"
            usdcAmount={gfiInUsdc}
            secondaryAmount={maxVaultableGfi}
            includeAmountInput
            inputMax={maxVaultableGfi.amount}
            onInputChange={(s) => setGfiToVault(s)}
          />
        ) : null}
        {vaultableStakedPositions.map((stakedPosition) => {
          const checked = stakedPositionsToVault.some(
            (s) => s.id === stakedPosition.id
          );
          return (
            <AssetCheckbox
              key={`staked-position-${stakedPosition.id}`}
              name="Senior Pool Staked Position"
              description="FIDU"
              usdcAmount={sharesToUsdc(stakedPosition.amount, sharePrice)}
              checked={checked}
              onChange={() => {
                if (!checked) {
                  setStakedPositionsToVault([
                    ...stakedPositionsToVault,
                    stakedPosition,
                  ]);
                } else {
                  setStakedPositionsToVault(
                    removeFromListById(
                      stakedPositionsToVault,
                      stakedPosition.id
                    )
                  );
                }
              }}
            />
          );
        })}
        {vaultablePoolTokens.map((poolToken) => {
          const checked = poolTokensToVault.some((p) => p.id === poolToken.id);
          return (
            <AssetCheckbox
              key={`pool-token-${poolToken.id}`}
              name="Backer Pool Position"
              description={poolToken.tranchedPool.name}
              usdcAmount={{
                amount: poolToken.principalAmount,
                token: SupportedCrypto.Usdc,
              }}
              checked={checked}
              onChange={() => {
                if (!checked) {
                  setPoolTokensToVault([...poolTokensToVault, poolToken]);
                } else {
                  setPoolTokensToVault(
                    removeFromListById(poolTokensToVault, poolToken.id)
                  );
                }
              }}
            />
          );
        })}
      </div>
      <div className="mb-2">
        <div className="mb-2 text-lg font-semibold">Vault rewards</div>
        <div className="flex divide-x divide-sand-200 rounded-lg border border-sand-200 bg-white">
          <div className="w-1/2 py-6 px-5">
            <div className="mb-3 flex items-center gap-2">
              <div className="text-sm text-sand-600">
                Est. share of member rewards
              </div>
              <InfoIconTooltip content="Lorem ipsum" />
            </div>
            <div className="text-lg font-medium">0.69%</div>
          </div>
          <div className="w-1/2 py-6 px-5">
            <div className="mb-3 flex items-center gap-2">
              <div className="text-sm text-sand-600">
                Projected member rewards
              </div>
              <InfoIconTooltip content="Lorem ipsum" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="text-lg font-medium">$420.69</div>
              <div className="text-sm text-sand-500">monthly avg</div>
            </div>
          </div>
        </div>
      </div>
      <div className="mb-8 text-xs">
        By clicking continue below, I agree to lorem ipsum dolor sit amet,
        consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore
        et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
        exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
        Duis aute irure dolor in reprehenderit in voluptate velit esse cillum
        dolore eu fugiat nulla pariatur.
      </div>
      <Button
        className="w-full"
        size="xl"
        onClick={() =>
          alert(
            `Confirming with GFI ${gfiToVault} staked positions ${stakedPositionsToVault
              .map((s) => s.id)
              .join(", ")}, pool tokens ${poolTokensToVault
              .map((p) => p.id)
              .join(", ")}`
          )
        }
      >
        Continue
      </Button>
    </Modal>
  );
}

function removeFromListById<T extends { id: string }>(
  list: T[],
  idToRemove: string
): T[] {
  return list.filter((item) => item.id !== idToRemove);
}

interface AssetCheckboxProps {
  name: string;
  tooltip?: string;
  description: string;
  usdcAmount: CryptoAmount;
  secondaryAmount?: CryptoAmount;
  checked?: boolean;
  onChange?: () => void;
  includeAmountInput?: boolean;
  inputMax?: BigNumber;
  onInputChange?: (s: string) => void;
}

function AssetCheckbox({
  name,
  tooltip,
  description,
  usdcAmount,
  secondaryAmount,
  checked = false,
  onChange = () => null, // this is just to avoid onChange being undefined (React complains about this)
  includeAmountInput = false,
  inputMax,
  onInputChange,
}: AssetCheckboxProps) {
  const { control, watch, setValue } = useForm<{ gfiToVault: string }>();
  const gfiToVault = watch("gfiToVault");
  useEffect(() => {
    onInputChange?.(gfiToVault);
  }, [onInputChange, gfiToVault]);

  return (
    <div className="relative rounded bg-white py-6 px-5">
      <div className="flex justify-between gap-3">
        <div className="flex items-start justify-between gap-5">
          <Checkbox
            inputSize="md"
            checked={
              includeAmountInput
                ? gfiToVault !== undefined && gfiToVault !== ""
                : checked
            }
            onChange={onChange}
            label={name}
            hideLabel
            tabIndex={-1}
          />
          <div className="-mt-0.5">
            <div className="mb-1 flex items-center gap-2">
              <button
                className="text-lg before:absolute before:inset-0"
                onClick={
                  includeAmountInput
                    ? () => setValue("gfiToVault", "")
                    : onChange
                }
              >
                {name}
              </button>
              {tooltip ? <InfoIconTooltip content={tooltip} /> : null}
            </div>
            <div className="text-xs font-medium text-sand-400">
              {description}
            </div>
          </div>
        </div>
        <div>
          <div className="mb-1 text-lg font-medium">
            {formatCrypto(usdcAmount)}
          </div>
          {secondaryAmount ? (
            <div className="text-right text-xs font-medium text-sand-400">
              {formatCrypto(secondaryAmount, { includeToken: true })}
            </div>
          ) : null}
        </div>
      </div>
      {includeAmountInput ? (
        <DollarInput
          label="GFI Amount"
          hideLabel
          name="gfiToVault"
          control={control}
          className="mt-3"
          unit={SupportedCrypto.Gfi}
          maxValue={inputMax}
        />
      ) : null}
    </div>
  );
}
