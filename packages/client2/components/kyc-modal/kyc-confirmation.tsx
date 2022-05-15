import Image from "next/image";

export function KYCConfirmation() {
  return (
    <div className="mt-10 flex w-full flex-col items-center">
      <Image src="/content/uid-logo.png" width={120} height={120} alt="UID" />

      <p className="my-5 text-center">
        Your identity verification review is in progress
      </p>

      <p className="text-center text-xs text-sand-500">
        After it has been approved, you can claim your UID and begin
        participating in lending pools. This should take less than 24-48 hrs.
      </p>
    </div>
  );
}
