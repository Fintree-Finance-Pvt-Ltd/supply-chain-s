import { EsignInput, EsignResult } from './esign.types';
import { createDoqfyEsign } from './doqfy.client';
import { createDigioEsign } from './digio.client';

export async function createEsignWithFallback(
  input: EsignInput,
): Promise<EsignResult> {
  // 1️⃣ Try Doqfy
  const doqfyResult = await createDoqfyEsign(input);

  if (doqfyResult.success) {
    return doqfyResult;
  }

  console.error('⚠️ Doqfy failed. Falling back to Digio', doqfyResult.error);

  // 2️⃣ Fallback to Digio
  const digioResult = await createDigioEsign(input);

  if (digioResult.success) {
    return digioResult;
  }

  // 3️⃣ Both failed
  return {
    success: false,
    error: {
      doqfy: doqfyResult.error,
      digio: digioResult.error,
    },
  };
}
