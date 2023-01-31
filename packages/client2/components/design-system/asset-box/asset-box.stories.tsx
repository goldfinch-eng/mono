import { ComponentMeta, ComponentStory } from "@storybook/react";
import { BigNumber } from "ethers";
import { useForm } from "react-hook-form";

import { formatCrypto, stringToCryptoAmount } from "@/lib/format";

import { Form } from "../form";
import { AssetBox, AssetInputBox } from "./index";

export default {
  title: "Components/AssetBox",
  component: AssetBox,
} as ComponentMeta<typeof AssetBox>;

const gfiAsset = {
  name: "GFI",
  description: "Goldfinch Token",
  nativeAmount: {
    token: "GFI",
    amount: BigNumber.from("100000000000000000000"),
  },
  usdcAmount: {
    token: "USDC",
    amount: BigNumber.from("200000000"),
  },
} as const;

export const AssetBoxStory: ComponentStory<typeof AssetBox> = () => {
  return (
    <div className="max-w-lg bg-sand-100 p-5">
      <AssetBox asset={gfiAsset} />
    </div>
  );
};

export const AssetInputBoxStory: ComponentStory<typeof AssetInputBox> = () => {
  const rhfMethods = useForm<{ gfi: string }>();
  return (
    <Form
      rhfMethods={rhfMethods}
      onSubmit={(data) =>
        alert(formatCrypto(stringToCryptoAmount(data.gfi, "GFI")))
      }
    >
      <AssetInputBox
        asset={gfiAsset}
        control={rhfMethods.control}
        name="gfi"
        label="Enter GFI"
        fiatPerGfi={2}
      />
    </Form>
  );
};
