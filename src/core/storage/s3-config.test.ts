import { describe, expect, it } from "vitest";
import { resolveStorageEndpoint, storageClientConfig, storageConnectSources } from "./s3-config";

const R2 = { R2_ACCOUNT_ID: "abc123" };
const MINIO = {
  S3_ENDPOINT: "https://minio.exemplo.com",
  S3_REGION: "us-east-1",
  S3_FORCE_PATH_STYLE: "true",
};
const CREDS = { R2_ACCESS_KEY_ID: "chave", R2_SECRET_ACCESS_KEY: "segredo" };

describe("resolveStorageEndpoint", () => {
  it("sem S3_ENDPOINT, monta o endpoint do R2 pela conta (comportamento antigo)", () => {
    expect(resolveStorageEndpoint(R2)).toEqual({
      endpoint: "https://abc123.r2.cloudflarestorage.com",
      region: "auto",
      forcePathStyle: false,
    });
  });

  it("S3_ENDPOINT vence o R2_ACCOUNT_ID e fica só com a origem (sem barra final)", () => {
    expect(resolveStorageEndpoint({ ...R2, ...MINIO, S3_ENDPOINT: "https://minio.exemplo.com/" })).toEqual({
      endpoint: "https://minio.exemplo.com",
      region: "us-east-1",
      forcePathStyle: true,
    });
  });

  it("só o valor exato true (sem caixa nem espaços) liga o path-style", () => {
    for (const value of ["true", "TRUE", " True "]) {
      expect(resolveStorageEndpoint({ ...R2, S3_FORCE_PATH_STYLE: value })?.forcePathStyle).toBe(true);
    }
    for (const value of ["1", "yes", "false", ""]) {
      expect(resolveStorageEndpoint({ ...R2, S3_FORCE_PATH_STYLE: value })?.forcePathStyle).toBe(false);
    }
  });

  it("região vazia volta para auto", () => {
    expect(resolveStorageEndpoint({ ...R2, S3_REGION: "  " })?.region).toBe("auto");
  });

  it("sem endpoint nem conta, devolve null", () => {
    expect(resolveStorageEndpoint({})).toBeNull();
    expect(resolveStorageEndpoint({ S3_ENDPOINT: "  ", R2_ACCOUNT_ID: "" })).toBeNull();
  });

  it("recusa S3_ENDPOINT que não é URL http(s)", () => {
    expect(() => resolveStorageEndpoint({ S3_ENDPOINT: "minio.exemplo.com" })).toThrow(/S3_ENDPOINT inválido/);
    expect(() => resolveStorageEndpoint({ S3_ENDPOINT: "ftp://minio.exemplo.com" })).toThrow(/http\(s\)/);
  });
});

describe("storageConnectSources", () => {
  it("R2 (virtual-hosted): o host da conta e o curinga dos buckets", () => {
    expect(storageConnectSources(R2)).toEqual([
      "https://abc123.r2.cloudflarestorage.com",
      "https://*.abc123.r2.cloudflarestorage.com",
    ]);
  });

  it("MinIO (path-style): só o host, o bucket vai no caminho", () => {
    expect(storageConnectSources(MINIO)).toEqual(["https://minio.exemplo.com"]);
  });

  it("endpoint com porta mantém a porta no curinga", () => {
    expect(storageConnectSources({ S3_ENDPOINT: "http://localhost:9000" })).toEqual([
      "http://localhost:9000",
      "http://*.localhost:9000",
    ]);
  });

  it("sem armazenamento configurado, não libera nada", () => {
    expect(storageConnectSources({})).toEqual([]);
  });
});

describe("storageClientConfig", () => {
  it("junta endpoint e credenciais (sem espaços em volta)", () => {
    expect(
      storageClientConfig({ ...MINIO, R2_ACCESS_KEY_ID: " chave ", R2_SECRET_ACCESS_KEY: "segredo\n" })
    ).toEqual({
      endpoint: "https://minio.exemplo.com",
      region: "us-east-1",
      forcePathStyle: true,
      credentials: { accessKeyId: "chave", secretAccessKey: "segredo" },
    });
  });

  it("lança sem credencial ou sem endpoint", () => {
    expect(() => storageClientConfig({ ...MINIO })).toThrow(/Armazenamento não configurado/);
    expect(() => storageClientConfig({ ...CREDS })).toThrow(/Armazenamento não configurado/);
  });
});
