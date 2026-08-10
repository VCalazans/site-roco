import "server-only";
import IORedis from "ioredis";

export interface RateLimitOptions {
  /** Duração da janela fixa, em segundos. */
  windowSeconds: number;
  /** Nº máximo de hits permitidos dentro da janela. */
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Hits restantes na janela atual (0 quando `allowed` é `false`). */
  remaining: number;
  /** Segundos até a janela expirar (0 quando `allowed` é `true`). */
  retryAfterSeconds: number;
}

declare global {
  var __rocoRateLimitRedis: IORedis | null | undefined;
  var __rocoRateLimitWarned: boolean | undefined;
}

/**
 * Cliente Redis lazy, dedicado ao rate limiter (conexão própria — não
 * reaproveita a do BullMQ em `erp-sync-queue.ts`, que exige
 * `maxRetriesPerRequest: null` para comandos bloqueantes). `null` quando
 * `REDIS_URL` não está configurada (dev local sem Redis, ou build).
 */
function getRedis(): IORedis | null {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    if (!globalThis.__rocoRateLimitWarned) {
      console.warn(
        "[rate-limit] REDIS_URL não configurado — rate limiting DESLIGADO (fail-open). " +
          "Aceitável em desenvolvimento; NUNCA opere produção assim (login, webhook, " +
          "uploads e o catálogo público ficam sem proteção de força bruta/abuso)."
      );
      globalThis.__rocoRateLimitWarned = true;
    }
    return null;
  }

  if (globalThis.__rocoRateLimitRedis === undefined) {
    const client = new IORedis(redisUrl, {
      maxRetriesPerRequest: 1,
      // Nunca deixe o rate limiter travar a resposta HTTP esperando o Redis.
      connectTimeout: 2_000,
    });
    client.on("error", (error) => {
      console.error("[rate-limit] Erro de conexão com Redis.", error.message);
    });
    globalThis.__rocoRateLimitRedis = client;
  }

  return globalThis.__rocoRateLimitRedis;
}

/**
 * Rate limiter fixed-window sobre Redis. `INCR` + `EXPIRE NX` (o `NX` só
 * define o TTL na primeira chamada da janela) rodam dentro de uma transação
 * `MULTI`/`EXEC`, então não há corrida entre o incremento e a definição do
 * TTL — mesmo sob concorrência, o contador nunca fica "imortal" (sem TTL) nem
 * o TTL é resetado a cada hit.
 *
 * TRADE-OFF (fail-open): sem `REDIS_URL` configurada, esta função sempre
 * retorna `allowed: true` e loga um único `console.warn` no processo — a
 * ausência de Redis (comum em dev local, ou num build sem serviços de pé)
 * nunca deve derrubar login/uploads/rotas públicas. Isso é uma escolha
 * deliberada de disponibilidade sobre proteção: rodar produção sem Redis
 * configurado deixa TODOS os limites (login, webhook, presign, REST
 * público) desligados sem qualquer erro visível além do warn no log.
 */
export async function checkRateLimit(
  key: string,
  opts: RateLimitOptions
): Promise<RateLimitResult> {
  const redis = getRedis();
  if (!redis) {
    return { allowed: true, remaining: opts.max, retryAfterSeconds: 0 };
  }

  const redisKey = `ratelimit:${key}`;

  try {
    const results = await redis
      .multi()
      .incr(redisKey)
      .expire(redisKey, opts.windowSeconds, "NX")
      .exec();

    // `exec()` retorna `null` só quando a transação foi abortada (ex.: WATCH
    // em conflito — não usamos WATCH aqui, então isto é defensivo).
    if (!results) {
      return { allowed: true, remaining: opts.max, retryAfterSeconds: 0 };
    }

    const [incrError, count] = results[0] as [Error | null, number];
    if (incrError) {
      throw incrError;
    }

    const allowed = count <= opts.max;
    const remaining = Math.max(0, opts.max - count);

    if (allowed) {
      return { allowed: true, remaining, retryAfterSeconds: 0 };
    }

    const ttl = await redis.ttl(redisKey);
    const retryAfterSeconds = ttl > 0 ? ttl : opts.windowSeconds;
    return { allowed: false, remaining: 0, retryAfterSeconds };
  } catch (error) {
    console.error("[rate-limit] Falha ao checar limite — fail-open.", error);
    return { allowed: true, remaining: opts.max, retryAfterSeconds: 0 };
  }
}

/**
 * IP do cliente a partir de `x-forwarded-for` (primeiro valor da lista —
 * mais próximo do cliente atrás de proxies/CDN confiáveis). `"unknown"`
 * quando o header não está presente (ex.: request direto, sem proxy).
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const first = forwardedFor?.split(",")[0]?.trim();
  return first && first.length > 0 ? first.toLowerCase() : "unknown";
}

/** Normaliza chaves de rate limit derivadas de input do usuário (e-mail, IP). */
export function normalizeRateLimitKeyPart(value: string): string {
  return value.trim().toLowerCase();
}
