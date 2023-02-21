import { useForm } from "react-hook-form";

import { Form, Button, Input } from "@/components/design-system";

import { devserverRequest } from "./helpers";

export function BorrowTools() {
  return (
    <div>
      <div className="mb-2 text-2xl font-bold">Borrow</div>
      <div className="space-y-6">
        <AssessTranchedPool />
      </div>
    </div>
  );
}

function AssessTranchedPool() {
  type FormFields = { poolAddress: string };
  const rhfMethods = useForm<FormFields>();

  const onSubmit = async (data: FormFields) => {
    const response = await devserverRequest("assessTranchedPool", {
      tranchedPoolAddress: data.poolAddress,
    });
    if (!response.ok) {
      throw new Error((await response.json()).message);
    }
  };

  return (
    <Form rhfMethods={rhfMethods} onSubmit={onSubmit}>
      <div className="mb-1 text-lg font-medium">Assess Tranched Pool</div>
      <div className="flex gap-2">
        <Input
          label="Tranched Pool"
          hideLabel
          inputMode="text"
          {...rhfMethods.register("poolAddress", {
            required: "Pool address required.",
          })}
        />
        <Button type="submit">Assess</Button>
      </div>
    </Form>
  );
}
