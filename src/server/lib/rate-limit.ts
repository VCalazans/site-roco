import "server-only";
import { BlockList, isIP } from "node:net";
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
  /**
   * `true` quando a recusa veio do FAIL-CLOSED (Redis ausente ou fora do ar),
   * não de um teto de fato estourado. Sem esta distinção, a primeira
   * tentativa de um visitante numa janela de instabilidade do Redis é
   * respondida com "muitas tentativas em sequência" — acusando-o de uma
   * repetição que não houve e mandando o suporte investigar a coisa errada.
   */
  unavailable?: boolean;
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
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: opts.windowSeconds,
        unavailable: true,
      };
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
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: opts.windowSeconds,
          unavailable: true,
        };
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
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: opts.windowSeconds,
        unavailable: true,
      };
    }
    return { allowed: true, remaining: opts.max, retryAfterSeconds: 0 };
  }
}

/**
 * Faixas de IP da borda da Cloudflare — fonte: https://www.cloudflare.com/ips-v4
 * e https://www.cloudflare.com/ips-v6, baixadas em 2026-10-12.
 *
 * ⚠️ ATUALIZE se a Cloudflare mudar as faixas. Uma borda nova fora desta lista
 * não abre brecha (o pedido é tratado como vindo direto, e o IP devolvido é o
 * da própria borda), mas todos os visitantes que passarem por ela dividem o
 * mesmo limite por IP e chegam ao Turnstile com o IP da Cloudflare.
 */
const CLOUDFLARE_IP_RANGES = {
  ipv4: [
    "173.245.48.0/20",
    "103.21.244.0/22",
    "103.22.200.0/22",
    "103.31.4.0/22",
    "141.101.64.0/18",
    "108.162.192.0/18",
    "190.93.240.0/20",
    "188.114.96.0/20",
    "197.234.240.0/22",
    "198.41.128.0/17",
    "162.158.0.0/15",
    "104.16.0.0/13",
    "104.24.0.0/14",
    "172.64.0.0/13",
    "131.0.72.0/22",
  ],
  ipv6: [
    "2400:cb00::/32",
    "2606:4700::/32",
    "2803:f800::/32",
    "2405:b500::/32",
    "2405:8100::/32",
    "2a06:98c0::/29",
    "2c0f:f248::/32",
  ],
} as const;

const cloudflareEdges = (() => {
  const list = new BlockList();
  for (const type of ["ipv4", "ipv6"] as const) {
    for (const cidr of CLOUDFLARE_IP_RANGES[type]) {
      const [network, prefix] = cidr.split("/");
      list.addSubnet(network, Number(prefix), type);
    }
  }
  return list;
})();

/** `true` quando o IP (já normalizado) é de uma borda da Cloudflare. */
function isCloudflareEdge(ip: string): boolean {
  const version = isIP(ip);
  if (version === 0) return false;
  try {
    return cloudflareEdges.check(ip, version === 4 ? "ipv4" : "ipv6");
  } catch {
    return false;
  }
}

/**
 * Endereço IPv4/IPv6 válido, normalizado (sem espaços, minúsculo), ou `null`.
 * Descarta a porta que alguns proxies anexam (`1.2.3.4:5678`, `[::1]:443`) e
 * desembrulha o IPv4 mapeado em IPv6 (`::ffff:1.2.3.4` → `1.2.3.4`, como o Node
 * às vezes reporta o socket). Qualquer outra coisa — nome de host, lixo — é `null`.
 */
function normalizeIp(value: string | null | undefined): string | null {
  let candidate = value?.trim().toLowerCase();
  if (!candidate) return null;
  const bracketed = /^\[([^\]]+)\](?::\d{1,5})?$/.exec(candidate);
  if (bracketed) candidate = bracketed[1];
  else {
    const withPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/.exec(candidate);
    if (withPort) candidate = withPort[1];
  }
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(candidate);
  if (mapped) candidate = mapped[1];
  return isIP(candidate) === 0 ? null : candidate;
}

/**
 * IP do visitante para os limites por IP, o audit log e o Turnstile.
 *
 * Só o ÚLTIMO item do `x-forwarded-for` é confiável: é o par TCP que o proxy
 * da frente (o Traefik do EasyPanel) acrescentou — o Next só preenche o
 * cabeçalho quando ele não existe. Todo o resto pode ter vindo do cliente.
 * Pela Cloudflare a lista chega como `<o que o cliente mandou>, <IP real>,
 * <borda da Cloudflare>`; direto na origem, `<o que o cliente mandou>, <IP de
 * quem conectou>`. Regra:
 *
 * 1. `peer` = último item válido do `x-forwarded-for` (sem ele, `x-real-ip`);
 * 2. `peer` é borda da Cloudflare (`CLOUDFLARE_IP_RANGES`) → vale o
 *    `cf-connecting-ip` (a Cloudflare o sobrescreve); se faltar, o item
 *    anterior ao `peer` (o IP real que a Cloudflare acrescentou); senão o `peer`;
 * 3. `peer` NÃO é da Cloudflare → o próprio `peer`. Nunca o primeiro item do
 *    `x-forwarded-for` nem o `cf-connecting-ip`: a origem responde direto, sem
 *    passar pela Cloudflare, e quem chega assim escreve esses dois cabeçalhos
 *    como quiser — um robô trocaria de "IP" a cada requisição e furaria os
 *    limites.
 *
 * `"unknown"` quando não há nenhum IP válido. Pressupõe um proxy na frente que
 * ACRESCENTE ao `x-forwarded-for` (o Traefik faz isso): com o servidor exposto
 * sem proxy, a lista inteira seria do cliente.
 */
export function getClientIp(request: Request): string {
  return resolveClientIp(request).ip;
}

export type ClientIpResolution = {
  /** IP usado nos limites, no audit log e no Turnstile (`"unknown"` sem nenhum válido). */
  ip: string;
  /** O par TCP do proxy da frente é uma borda da Cloudflare (o pedido passou por ela). */
  viaCloudflare: boolean;
  /** Quantos itens o `x-forwarded-for` trouxe. */
  forwardedHops: number;
};

/**
 * `getClientIp` com o diagnóstico de COMO o IP foi escolhido — exposto nas
 * métricas autenticadas de `/api/health` para conferir no ambiente real a
 * premissa da regra acima (o último item do `x-forwarded-for` é o par TCP do
 * proxy). Se um ambiente atrás da Cloudflare mostrar `viaCloudflare: false`
 * com um IP interno (10.x, 172.16–31.x, 192.168.x), algo entre a Cloudflare
 * e o app troca o IP de origem (ex.: porta publicada pelo ingress do Docker
 * Swarm) — e todos os visitantes estariam dividindo o mesmo limite por IP.
 */
export function resolveClientIp(request: Request): ClientIpResolution {
  const hops = (request.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((hop) => hop.trim())
    .filter((hop) => hop !== "");
  const lastHop = normalizeIp(hops.at(-1));
  const peer = lastHop ?? normalizeIp(request.headers.get("x-real-ip"));
  if (!peer) return { ip: "unknown", viaCloudflare: false, forwardedHops: hops.length };
  if (!isCloudflareEdge(peer)) return { ip: peer, viaCloudflare: false, forwardedHops: hops.length };
  // O "item anterior ao peer" só existe quando o peer veio da lista.
  const realIp = normalizeIp(request.headers.get("cf-connecting-ip")) ?? (lastHop ? normalizeIp(hops.at(-2)) : null);
  return { ip: realIp ?? peer, viaCloudflare: true, forwardedHops: hops.length };
}

/** Normaliza chaves de rate limit derivadas de input do usuário (e-mail, IP). */
export function normalizeRateLimitKeyPart(value: string): string {
  return value.trim().toLowerCase();
}
