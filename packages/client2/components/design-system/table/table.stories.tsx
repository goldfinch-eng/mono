import { ComponentStory, ComponentMeta } from "@storybook/react";

import { Table, HeavyTable, MiniTable } from "./index";

export default {
  title: "Components/Table",
  component: Table,
} as ComponentMeta<typeof Table>;

const row = ["One", "Two", "Three"];

export const TableStory: ComponentStory<typeof Table> = () => {
  return (
    <Table
      headings={["Alpha", "Beta", "Gamma"]}
      rows={[row, row, row, row, row, row, row, row]}
    />
  );
};

export const HeavyTableStory: ComponentStory<typeof HeavyTable> = () => {
  return (
    <HeavyTable
      rows={[
        ["Heading1", null, "Lorem ipsum dolor sit amet"],
        [
          "Heading2",
          "Heading2 tooltip",
          "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
        ],
      ]}
    />
  );
};

export const MiniTableStory: ComponentStory<typeof MiniTable> = () => {
  return (
    <div className="bg-twilight-900 p-10">
      <MiniTable
        deemphasizeMiddleCols
        rows={[
          ["USDC", "1000", "4.20%"],
          ["GFI", "69", "4.20%"],
        ]}
      />
    </div>
  );
};
