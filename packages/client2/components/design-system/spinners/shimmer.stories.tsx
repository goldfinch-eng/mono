import { ComponentStory, ComponentMeta } from "@storybook/react";

import { ShimmerLines } from "./index";

export default {
  title: "Components/Spinners/Shimmer",
  component: ShimmerLines,
  argTypes: {
    className: {
      control: false,
    },
  },
} as ComponentMeta<typeof ShimmerLines>;

export const ShimmerStory: ComponentStory<typeof ShimmerLines> = (args) => (
  <ShimmerLines {...args} />
);

ShimmerStory.args = {
  lines: 1,
  truncateFirstLine: false,
};
