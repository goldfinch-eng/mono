import { ComponentStory, ComponentMeta } from "@storybook/react";

import { Spinner } from ".";

export default {
  component: Spinner,
  title: "Components/Spinners/Spinner",
} as ComponentMeta<typeof Spinner>;

export const SpinnerStory: ComponentStory<typeof Spinner> = () => (
  <div className="flex gap-4">
    <Spinner className="h-10 w-10" />
    <Spinner className="h-10 w-10 text-eggplant-300" />
    <Spinner className="h-10 w-10" style={{ color: "orange" }} />
  </div>
);
