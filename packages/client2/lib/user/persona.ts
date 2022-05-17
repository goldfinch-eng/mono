import { PERSONA_CONFIG } from "@/constants";

interface PersonaFormProps {
  address: string;
  onReady?: () => void;
  onComplete?: () => void;
  onError?: () => void;
  onCancel?: () => void;
}

export async function openPersonaForm({
  address,
  onReady,
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
      onReady && onReady();
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
