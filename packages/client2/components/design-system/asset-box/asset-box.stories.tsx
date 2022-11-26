import { ComponentMeta } from "@storybook/react";

import { AssetBox } from "./index";

export default {
  title: "Components/AssetBox",
  component: AssetBox,
} as ComponentMeta<typeof AssetBox>;

// const gfiAsset = {
//   name: "GFI",
//   description: "Goldfinch Token",
//   nativeAmount: {
//     token: SupportedCrypto.Gfi,
//     amount: BigNumber.from("100000000000000000000"),
//   },
//   usdcAmount: {
//     token: SupportedCrypto.Usdc,
//     amount: BigNumber.from("200000000"),
//   },
// };

// export const AssetBoxStory: ComponentStory<typeof AssetBox> = () => {
//   return (
//     <div className="max-w-lg bg-sand-100 p-5">
//       <AssetBox asset={gfiAsset} />
//     </div>
//   );
// };

// export const AssetInputBoxStory: ComponentStory<typeof AssetInputBox> = () => {
//   const rhfMethods = useForm<{ gfi: string }>();
//   return (
//     <Form
//       rhfMethods={rhfMethods}
//       onSubmit={(data) =>
//         alert(formatCrypto(stringToCryptoAmount(data.gfi, SupportedCrypto.Gfi)))
//       }
//     >
//       <AssetInputBox
//         asset={gfiAsset}
//         control={rhfMethods.control}
//         name="gfi"
//         label="Enter GFI"
//         fiatPerGfi={2}
//       />
//     </Form>
//   );
// };
export const AssetBoxStory = () => {
  return "TODO. These stories can't exist yet. It's because the components depend on lib files that have Apollo code mixed in. Storybook can't mock Apollo successfully.";
};
