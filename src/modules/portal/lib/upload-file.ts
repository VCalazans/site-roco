/**
 * Fluxo de upload direto client → R2, comum a documentos de onboarding e
 * imagens de produto: `presign*Upload` (tRPC) → PUT direto no `uploadUrl`
 * presignado → `confirm*Upload` (tRPC) grava o registro no banco. Ver
 * `src/core/storage/r2.ts` (backend, não tocado por este agente).
 */
export type PresignedUpload = {
  uploadUrl: string;
  key: string;
};

export async function uploadFileDirect(
  file: File,
  presign: PresignedUpload
): Promise<void> {
  const response = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Upload falhou (HTTP ${response.status}).`);
  }
}
