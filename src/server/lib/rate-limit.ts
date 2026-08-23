import "server-only";
import IORedis from "ioredis";

export interface RateLimitOptions {
  /** Duração da janela fixa, em segundos. */
  windowSeconds: number;
  /** Nº máximo de hits permitidos dentro da janela. */
  max: number;
  /**
   * Quando `true`, a função falha de forma SEGURA (retorna `allowed: false`)
   * caso o Redis não esteja configurado OU a chamada falhe — proteção
   * obrigatória em produção para rotas de autenticação, webhook e
   * qualquer endpoint sensível a abuso. Quando `false` (padrão), mantém
   * fail-open para preservar a experiência de dev local sem Redis.
   *
   * TRADE-OFF: esquecer `productionSafe: true` em uma rota de auth deixa
   * a porta aberta sem rate-limit quando o Redis cai — exatamente o
   * cenário que queremos evitar. Toda rota de auth existente DEVE ser
   * atualizada para passar `productionSafe: true` (backlog aberto; ver
   * decisionLog 2026-08-23).
   */
  productionSafe?: boolean;
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
  const failClosed = opts.productionSafe === true;

  // Fail-closed: quando a rota é sensível a abuso e o Redis não está
  // respondendo, melhor negar a request (e acender alerta) do que liberar
  // tudo. Fail-open (padrão) preserva o fluxo de dev sem Redis.
  if (!redis) {
    if (failClosed) {
      console.error(
        "[rate-limit] REDIS indisponível em rota productionSafe — bloqueando request.",
      );
      return { allowed: false, remaining: 0, retryAfterSeconds: opts.windowSeconds };
    }
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
      if (failClosed) {
        return { allowed: false, remaining: 0, retryAfterSeconds: opts.windowSeconds };
      }
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
    console.error("[rate-limit] Falha ao checar limite — fail-" + (failClosed ? "closed" : "open") + ".", error);
    if (failClosed) {
      return { allowed: false, remaining: 0, retryAfterSeconds: opts.windowSeconds };
    }
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
