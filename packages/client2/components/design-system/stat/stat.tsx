import { Icon } from "@/components/design-system/icon";

interface StatProps {
  label: string;
  value: string;
  tooltip?: string;
}

export function Stat({ label, value, tooltip }: StatProps) {
  return (
    <div>
      <div className="items-middle mb-3 flex text-sm text-sand-600">
        {label}{" "}
        {tooltip && (
          <span className="ml-1 text-sand-400">
            <Icon name="InfoCircleFilled" size="sm" />
          </span>
        )}
      </div>
      <div className="text-2xl font-medium text-sand-700">{value}</div>
    </div>
  );
}
