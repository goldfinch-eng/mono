import { ComponentStory, ComponentMeta } from "@storybook/react";

import { Spinner } from ".";

export default {
  component: Spinner,
  title: "Components/Spinners/Spinner",
} as ComponentMeta<typeof Spinner>;

export const SpinnerStory: ComponentStory<typeof Spinner> = () => <Spinner />;
