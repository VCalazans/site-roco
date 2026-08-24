/**
 * Fluxo de upload direto client → R2, comum a documentos de onboarding,
 * imagens de produto, mídia do hero e materiais: `presign*Upload` (tRPC) →
 * PUT direto no `uploadUrl` presignado → `confirm*Upload` (tRPC) grava o
 * registro no banco. Ver `src/core/storage/r2.ts` (backend, não tocado por
 * este agente).
 */
export type PresignedUpload = {
  uploadUrl: string;
  key: string;
};

/**
 * `onProgress` (0–100) é opcional. Quando fornecido, o PUT usa
 * `XMLHttpRequest` em vez de `fetch` — `fetch` não expõe um evento de
 * progresso de UPLOAD confiável entre browsers (só `ReadableStream` de
 * download), enquanto `xhr.upload.onprogress` é suportado universalmente.
 * Sem o terceiro argumento, o comportamento é idêntico ao de antes (`fetch`
 * simples) — retrocompatível com os chamadores existentes (ex.:
 * `product-images-manager.tsx`, `documents-step.tsx`).
 */
export async function uploadFileDirect(
  file: File,
  presign: PresignedUpload,
  onProgress?: (percent: number) => void
): Promise<void> {
  if (!onProgress) {
    const response = await fetch(presign.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });

    if (!response.ok) {
      throw new Error(`Upload falhou (HTTP ${response.status}).`);
    }
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", presign.uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress((event.loaded / event.total) * 100);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload falhou (HTTP ${xhr.status}).`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload falhou (erro de rede)."));
    xhr.send(file);
  });
}
