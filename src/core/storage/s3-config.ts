/**
 * Conexão com o armazenamento de arquivos: o Cloudflare R2 ou qualquer serviço
 * compatível com a API S3 — em produção, o MinIO (decisionLog 2026-10-12).
 *
 * Módulo puro, sem `server-only`, porque três lugares precisam dele: o cliente
 * do app (`./r2.ts`), os scripts de `src/db/` (rodam fora do Next, onde
 * `server-only` lança) e o `next.config.ts`, que monta a CSP em build-time.
 *
 * Variáveis:
 * - `S3_ENDPOINT` — URL da API S3. Ausente, vale o endpoint do R2 montado com
 *   `R2_ACCOUNT_ID` (o comportamento de antes desta mudança).
 * - `S3_REGION` — padrão `auto` (R2). O MinIO responde em `us-east-1`.
 * - `S3_FORCE_PATH_STYLE=true` — bucket no CAMINHO da URL
 *   (`https://host/bucket/chave`), e não no subdomínio. O MinIO exige.
 * - Credenciais, bucket e URL pública continuam em `R2_ACCESS_KEY_ID`,
 *   `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` e `R2_PUBLIC_URL`: o nome é histórico,
 *   valem para qualquer provedor.
 */

type Env = Readonly<Record<string, string | undefined>>;

export type StorageEndpoint = {
  /** Origem da API S3, sem barra final. */
  endpoint: string;
  region: string;
  forcePathStyle: boolean;
};

export type StorageClientConfig = StorageEndpoint & {
  credentials: { accessKeyId: string; secretAccessKey: string };
};

/** Endpoint, região e estilo de URL; `null` quando nada foi configurado. */
export function resolveStorageEndpoint(env: Env = process.env): StorageEndpoint | null {
  const region = env.S3_REGION?.trim() || "auto";
  const forcePathStyle = env.S3_FORCE_PATH_STYLE?.trim().toLowerCase() === "true";

  const custom = env.S3_ENDPOINT?.trim();
  if (custom) {
    let url: URL;
    try {
      url = new URL(custom);
    } catch {
      throw new Error(`S3_ENDPOINT inválido: "${custom}" (esperado algo como https://minio.exemplo.com).`);
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error(`S3_ENDPOINT precisa ser http(s): "${custom}".`);
    }
    return { endpoint: url.origin, region, forcePathStyle };
  }

  const accountId = env.R2_ACCOUNT_ID?.trim();
  if (!accountId) return null;
  return { endpoint: `https://${accountId}.r2.cloudflarestorage.com`, region, forcePathStyle };
}

/**
 * Origens que o navegador alcança no upload presignado (`connect-src` da CSP).
 *
 * Sem path-style, o AWS SDK gera a URL em virtual-hosted-style — o bucket vira
 * SUBDOMÍNIO (`https://<bucket>.<host>/chave`) —, então entra também o curinga
 * do host. Liberar só o host bloqueava todo upload vindo do navegador (ver o
 * comentário da CSP em `next.config.ts`). Com path-style, o host basta.
 */
export function storageConnectSources(env: Env = process.env): string[] {
  const resolved = resolveStorageEndpoint(env);
  if (!resolved) return [];
  if (resolved.forcePathStyle) return [resolved.endpoint];
  const { protocol, host } = new URL(resolved.endpoint);
  return [resolved.endpoint, `${protocol}//*.${host}`];
}

/** Configuração completa do cliente S3; lança se faltar endpoint ou credencial. */
export function storageClientConfig(env: Env = process.env): StorageClientConfig {
  const resolved = resolveStorageEndpoint(env);
  const accessKeyId = env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim();
  if (!resolved || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Armazenamento não configurado: defina S3_ENDPOINT (ou R2_ACCOUNT_ID), R2_ACCESS_KEY_ID e R2_SECRET_ACCESS_KEY."
    );
  }
  return { ...resolved, credentials: { accessKeyId, secretAccessKey } };
}
