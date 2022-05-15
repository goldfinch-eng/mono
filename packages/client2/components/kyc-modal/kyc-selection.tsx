interface KYCSelectionProps {
  text: string;
  onClick: () => void;
}

export function KYCSelection({ text, onClick }: KYCSelectionProps) {
  return (
    <button
      className="block w-full rounded-[10px] border border-sand-300 bg-transparent p-6 text-left hover:bg-sand-100"
      onClick={onClick}
    >
      {text}
    </button>
  );
}
