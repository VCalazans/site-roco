import "server-only";
import { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { toPullStream } from "./pull-stream";

declare global {
  var __rocoR2Client: S3Client | undefined;
}

/**
 * Cliente S3 apontado para o Cloudflare R2. Lazy: só lê as env vars e
 * constrói o client no primeiro uso, então importar este módulo nunca falha
 * (necessário para `next build` sem credenciais configuradas).
 */
function getClient(): S3Client {
  if (!globalThis.__rocoR2Client) {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error(
        "Credenciais do R2 não configuradas (R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY)."
      );
    }

    globalThis.__rocoR2Client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  return globalThis.__rocoR2Client;
}

function getBucket(): string {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) {
    throw new Error("R2_BUCKET não configurado.");
  }
  return bucket;
}

/**
 * URL presignada para PUT direto do browser (fluxo: presign → upload →
 * confirm). Ver decisionLog 2026-08-09 ("Imagens de produto: Cloudflare R2").
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 300,
  options: {
    /**
     * Tamanho declarado pelo cliente. Informado, a URL passa a ASSINAR
     * `content-type` e `content-length`: um PUT com outro tipo ou outro
     * tamanho falha na assinatura, em vez de gravar bytes arbitrários no
     * bucket público (o presigner deixa `content-type` fora da assinatura por
     * padrão). O navegador já manda os dois iguais aos declarados
     * (`uploadFileDirect`). Opt-in: fluxos antigos seguem como estavam.
     */
    sizeBytes?: number;
  } = {}
): Promise<string> {
  const bindSize = options.sizeBytes !== undefined;
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    ContentType: contentType,
    ...(bindSize ? { ContentLength: options.sizeBytes } : {}),
  });
  return getSignedUrl(getClient(), command, {
    expiresIn,
    ...(bindSize ? { signableHeaders: new Set(["content-type", "content-length"]) } : {}),
  });
}

/** URL pública (via `R2_PUBLIC_URL`, ex.: domínio custom ou r2.dev) do objeto. */
export function getPublicUrl(key: string): string {
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!publicUrl) {
    throw new Error("R2_PUBLIC_URL não configurado.");
  }
  return `${publicUrl.replace(/\/$/, "")}/${key.replace(/^\//, "")}`;
}

/**
 * URL presignada para GET (leitura temporária) — usada para objetos privados
 * (ex.: documentos de representantes), que não têm `R2_PUBLIC_URL`.
 */
export async function getPresignedDownloadUrl(
  key: string,
  expiresIn = 300,
  options: {
    /** Sobrescreve o `Content-Disposition` da resposta (`inline`/`attachment; filename=…`). */
    contentDisposition?: string;
  } = {}
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: key,
    ...(options.contentDisposition ? { ResponseContentDisposition: options.contentDisposition } : {}),
  });
  return getSignedUrl(getClient(), command, { expiresIn });
}

/**
 * Conteúdo do objeto como stream — os bytes ORIGINAIS, sem passar pelo
 * otimizador de imagem. Usado pelo ZIP de imagens de produto, que lê cada
 * objeto aos pedaços sem carregar nenhum inteiro na memória. Lido sob demanda
 * (ver `toPullStream`), e não com `transformToWebStream()`.
 */
export async function getObjectStream(key: string): Promise<ReadableStream<Uint8Array>> {
  const response = await getClient().send(new GetObjectCommand({ Bucket: getBucket(), Key: key }));
  if (!(response.Body instanceof Readable)) {
    throw new Error(`Objeto sem conteúdo no R2: ${key}`);
  }
  return toPullStream(response.Body);
}

export async function deleteObject(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
}

/** Confirma existência/metadados do objeto antes do INSERT (evita registrar upload que falhou). */
export async function headObject(key: string) {
  return getClient().send(new HeadObjectCommand({ Bucket: getBucket(), Key: key }));
}
