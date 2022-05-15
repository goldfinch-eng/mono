import type { TUIDAttributes } from "./kyc-modal";
import { KYCSelection } from "./kyc-selection";

interface KYCStepProps {
  heading: string;
  choices: {
    label: string;
    value: TUIDAttributes;
  }[];
  onSelection: (selection: TUIDAttributes) => void;
}

export function KYCStep({ heading, choices, onSelection }: KYCStepProps) {
  return (
    <>
      <h5 className="mb-7 text-lg font-semibold">{heading}</h5>

      {choices.map((item) => (
        <div key={`${item.label}`} className="mb-2">
          <KYCSelection
            text={item.label}
            onClick={() => {
              onSelection(item.value);
            }}
          />
        </div>
      ))}

      <p className="mt-7 text-xs text-sand-500">
        All information is kept secure and will not be used for any purpose
        beyond executing your supply request. The only information we store is
        your ETH address, country, and approval status. We take privacy
        seriously. Why does Goldfinch KYC?
      </p>
    </>
  );
}
