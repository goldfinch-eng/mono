import { PERSONA_CONFIG } from "@/constants";

interface PersonaFormProps {
  address: string;
  onComplete?: () => void;
  onError?: () => void;
  onCancel?: () => void;
}

export async function openPersonaForm({
  address,
  onComplete,
  onError,
  onCancel,
}: PersonaFormProps) {
  // Import on client side only
  const Persona = await import("persona");

  const config = PERSONA_CONFIG;

  const client = new Persona.Client({
    templateId: config.templateId,
    environment: config.environment,
    referenceId: address,
    onReady: () => {
      client.open();
    },
    onComplete: () => {
      onComplete && onComplete();
      client.destroy();
    },
    onError: () => {
      onError && onError();
    },
    onCancel: () => {
      onCancel && onCancel();
      client.destroy();
    },
  });
}
