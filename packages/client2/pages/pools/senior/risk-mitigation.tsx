import { RiskTable } from "@/pages/pools/senior/risk-table";

export function RiskMitigation() {
  return (
    <div>
      <div className="mb-5 rounded-xl border border-sand-300 p-5">
        <div>Senior Pool capital risk</div>
      </div>
      <RiskTable />
    </div>
  );
}
