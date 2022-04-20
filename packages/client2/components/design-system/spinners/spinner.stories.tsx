import { ComponentStory, ComponentMeta } from "@storybook/react";

import { Spinner } from ".";

export default {
  component: Spinner,
  title: "Components/Spinners/Spinner",
} as ComponentMeta<typeof Spinner>;

export const SpinnerStory: ComponentStory<typeof Spinner> = () => (
  <div className="flex gap-4">
    <Spinner />
    <Spinner className="text-purple-300" />
    <Spinner style={{ color: "orange" }} />
  </div>
);
