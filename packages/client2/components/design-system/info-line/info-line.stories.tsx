import { ComponentMeta, ComponentStory } from "@storybook/react";

import { InfoLine } from "./index";

export default {
  component: InfoLine,
  title: "Components/InfoLine",
} as ComponentMeta<typeof InfoLine>;

export const InfoLineStory: ComponentStory<typeof InfoLine> = (args) => {
  return (
    <div>
      <InfoLine {...args} />
      <InfoLine {...args} />
      <InfoLine {...args} />
    </div>
  );
};

InfoLineStory.args = {
  label: "Thing",
  value: "Value",
  tooltip: "Tooltip",
};
