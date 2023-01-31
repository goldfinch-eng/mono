import clsx from "clsx";
import { UseControllerProps, useController } from "react-hook-form";

import { Checkbox } from "../input";
import { Asset, AssetBox } from "./asset-box";

interface AssetCheckboxProps {
  asset: Asset;
  checked: boolean;
  onChange: () => void;
}

function AssetCheckbox({
  asset,
  checked = false,
  onChange,
}: AssetCheckboxProps) {
  const { name, tooltip, description, usdcAmount, nativeAmount } = asset;
  return (
    <div
      className={clsx(
        "relative rounded border bg-white py-6 px-5",
        checked ? "border-black" : "border-white"
      )}
    >
      <div className="flex items-start gap-5">
        <Checkbox
          inputSize="md"
          checked={checked}
          onChange={onChange}
          label={name as string}
          hideLabel
          tabIndex={-1}
        />
        <AssetBox
          asset={{
            name: (
              <button
                type="button"
                className="text-lg before:absolute before:inset-0"
                onClick={onChange}
              >
                {name}
              </button>
            ),
            description,
            tooltip,
            usdcAmount,
            nativeAmount,
          }}
          omitWrapperStyle
        />
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AssetPickerProps = UseControllerProps<any> & {
  options: { id: string; asset: Asset }[];
};

export function AssetPicker({
  options,
  ...useControllerProps
}: AssetPickerProps) {
  const {
    field: { onChange, value },
  } = useController<Record<string, string[]>>({
    defaultValue: [],
    ...useControllerProps,
  });
  return (
    <div className="space-y-2">
      {options.map((option) => {
        const checked = value.includes(option.id);
        return (
          <AssetCheckbox
            key={option.id}
            asset={option.asset}
            checked={checked}
            onChange={() => {
              if (!checked) {
                onChange([...value, option.id]);
              } else {
                onChange(value.filter((v) => v !== option.id));
              }
            }}
          />
        );
      })}
    </div>
  );
}
