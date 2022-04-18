import { ComponentStory, ComponentMeta } from "@storybook/react";

import { Icon, IconNameType, iconManifest } from "./icon";

export default {
  component: Icon,
  title: "Components/Icon",
  argTypes: {
    className: {
      control: false,
    },
  },
} as ComponentMeta<typeof Icon>;

export const SingleIcon: ComponentStory<typeof Icon> = (args) => (
  <Icon {...args} />
);

SingleIcon.args = {
  name: "X",
  size: "md",
};

const allIconNames = Object.keys(iconManifest);
export const IconGallery = () => {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
        gap: "24px",
      }}
    >
      {allIconNames.map((name) => (
        <div key={name} className="flex flex-col items-center gap-2">
          <Icon name={name as IconNameType} size="md" />
          <p>{name}</p>
        </div>
      ))}
    </div>
  );
};
