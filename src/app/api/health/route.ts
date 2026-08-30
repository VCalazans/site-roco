import { NextResponse, type NextRequest } from "next/server";
import type { PoolClient } from "pg";
import { getWorkerRuntimeState } from "@/core/queue/register-workers";
import { dbPool, DB_POOL_MAX_CONNECTIONS } from "@/db";
import { readEventLoopDelay } from "@/server/lib/event-loop-monitor";
import { timingSafeEqualString } from "@/server/lib/timing-safe";

/**
 * Health check do processo.
 *
 * MOTIVO DE EXISTIR: o modo de falha deste sistema é LENTIDÃO SEM ERRO.
 * Site e portal são um processo Node, um event loop; renderizar página
 * satura ~1 core (medido: 120% de CPU com 30 requisições SSR concorrentes,
 * a home indo de ~20 ms para p90 432 ms, e NENHUM erro HTTP). Sem métrica
 * exposta, esse incidente é invisível até alguém reclamar.
 *
 * Nunca é pré-renderizada: precisa medir o processo vivo a cada chamada.
 */
export const dynamic = "force-dynamic";

/** Header por onde o segredo das métricas viaja. */
const METRICS_TOKEN_HEADER = "x-health-token";

/** Teto para conseguir uma conexão do pool no ping opcional ao banco. */
const DB_ACQUIRE_TIMEOUT_MS = 2_000;

/** Teto do `select 1` depois de já ter a conexão em mãos. */
const DB_QUERY_TIMEOUT_MS = 2_000;

/** Health check nunca pode ser servido de cache — mediria um passado. */
const NO_STORE = { "Cache-Control": "no-store, max-age=0" } as const;

/** Intervalo mínimo entre avisos de token inválido, para não virar canal de flood de log. */
const AUTH_WARN_INTERVAL_MS = 60_000;
let lastAuthWarnAt = 0;

/**
 * Aviso NO SERVIDOR quando alguém tenta acessar as métricas e não consegue.
 *
 * A resposta ao chamador continua idêntica à de quem não mandou token (ver
 * `hasMetricsAccess`), então isto não vira oráculo: log de servidor não chega
 * a quem está tentando. Existe para o caso real e chato — operador em plena
 * madrugada de incidente que não sabe se errou o token, errou o nome do
 * header ou se a env nem subiu no container. Throttle de 1/min para que uma
 * força bruta não use o log como vetor de flood. Nunca registra o valor
 * recebido.
 */
function warnMetricsAuthFailure(reason: string): void {
  const now = Date.now();
  if (now - lastAuthWarnAt < AUTH_WARN_INTERVAL_MS) {
    return;
  }
  lastAuthWarnAt = now;
  console.warn(`[api/health] Acesso às métricas negado: ${reason}.`);
}

/**
 * `true` só quando `HEALTH_METRICS_TOKEN` está configurado E o header bate
 * em comparação de tempo constante.
 *
 * O esperado é comparado já com `trim()`: um valor colado em painel de deploy
 * costuma vir com espaço ou quebra de linha no fim, e valor de header HTTP
 * nunca carrega `\n` — sem o trim, o token "certo" nunca casaria e a rota
 * ficaria mentindo em silêncio (o guard de "está configurado?" logo abaixo já
 * usava `trim()`; a comparação precisa usar o mesmo valor).
 *
 * DECISÃO DE SEGURANÇA — por que token errado NÃO vira 401: a resposta é
 * idêntica à de quem não mandou token nenhum. Um 401 confirmaria que
 * existe segredo configurado e daria o sinal de acerto/erro que torna
 * força bruta viável. Do lado de fora, a rota é indistinguível de um
 * health check comum.
 *
 * Sem a env definida, as métricas detalhadas simplesmente não existem para
 * ninguém — não há modo "aberto por padrão".
 */
function hasMetricsAccess(request: NextRequest): boolean {
  const provided = request.headers.get(METRICS_TOKEN_HEADER);
  const expected = process.env.HEALTH_METRICS_TOKEN?.trim();

  if (!expected) {
    if (provided) {
      warnMetricsAuthFailure("HEALTH_METRICS_TOKEN não está configurada neste processo");
    }
    return false;
  }

  if (!provided) {
    return false;
  }

  if (!timingSafeEqualString(provided, expected)) {
    warnMetricsAuthFailure(`token inválido no header ${METRICS_TOKEN_HEADER}`);
    return false;
  }

  return true;
}

/**
 * Resultado do ping opcional ao banco.
 *
 * `pool_saturated` e `timeout` NÃO são "banco fora do ar" — ver `pingDatabase`.
 */
type DatabasePing = {
  status: "ok" | "pool_saturated" | "timeout" | "error";
  latencyMs: number | null;
};

/**
 * `select 1` com timeouts próprios; nunca lança e nunca vaza detalhe do erro.
 *
 * ## Por que NÃO usa `db.execute` direto
 *
 * O pool não tem `connectionTimeoutMillis` (decisão deliberada: aquele
 * timeout é um `setTimeout` cru correndo no MESMO event loop saturado, então
 * dispara por CPU travada e não por pool cheio). Consequência verificada no
 * código do `pg-pool`: quando não há slot livre, `connect()` empurra o pedido
 * para `_pendingQueue` e ele fica pendente INDEFINIDAMENTE — não rejeita. Um
 * `Promise.race` com timeout em cima de `db.execute` faria duas coisas
 * erradas ao mesmo tempo:
 *
 * 1. reportaria "banco inalcançável" (e 503) quando o banco está impecável e
 *    o que faltou foi slot no pool — reproduzido contra Postgres real: pool
 *    ocupado dava `reachable: false` enquanto um `SELECT 1` num pool novo
 *    respondia em 9 ms;
 * 2. deixaria a query órfã na fila do pool PARA SEMPRE, somando +1 em
 *    `waitingCount` a cada chamada — o health check inflando a própria
 *    métrica que publica como "sinal de pressão real", e ainda furando a fila
 *    na frente de requisições de visitante quando o slot liberasse.
 *
 * Por isso aqui: (a) se o pool já está cheio e sem ocioso, nem tenta —
 * responde `pool_saturated` sem enfileirar nada; (b) a aquisição tem timeout
 * próprio e, se chegar atrasada, o client é devolvido na hora; (c) a query
 * tem timeout próprio e o `release` acontece no `finally` dela, nunca com
 * comando em voo.
 *
 * SATURAÇÃO NUNCA VIRA 503 — mesmo argumento do caminho público: um health
 * check que reprova sob carga convida o orquestrador a matar justamente o
 * container ocupado.
 */
async function pingDatabase(): Promise<DatabasePing> {
  const max = dbPool.options.max ?? DB_POOL_MAX_CONNECTIONS;
  if (dbPool.idleCount === 0 && dbPool.totalCount >= max) {
    return { status: "pool_saturated", latencyMs: null };
  }

  const startedAt = Date.now();
  let acquisitionTimedOut = false;

  const acquisition = dbPool.connect();
  // Se a conexão chegar depois do timeout, devolve na hora: sem isto, um
  // poll durante saturação deixaria client preso fora do pool.
  void acquisition
    .then((client) => {
      if (acquisitionTimedOut) client.release();
    })
    .catch(() => undefined);

  let acquireTimer: NodeJS.Timeout | undefined;
  const acquireTimeout = new Promise<"timeout">((resolve) => {
    acquireTimer = setTimeout(() => {
      acquisitionTimedOut = true;
      resolve("timeout");
    }, DB_ACQUIRE_TIMEOUT_MS);
  });

  let client: PoolClient;
  try {
    const acquired = await Promise.race([acquisition, acquireTimeout]);
    if (acquired === "timeout") {
      // Passou pela checagem acima e ainda assim não veio slot: o pool
      // encheu no meio do caminho. Continua sendo saturação, não banco fora.
      return { status: "pool_saturated", latencyMs: null };
    }
    client = acquired;
  } catch (error) {
    // Rejeição de `connect()` é falha REAL de conexão (recusa, DNS, auth).
    console.error("[api/health] Falha ao obter conexão do pool.", error);
    return { status: "error", latencyMs: null };
  } finally {
    if (acquireTimer) clearTimeout(acquireTimer);
  }

  // O `release` mora no `finally` da própria query: soltar o client com
  // comando em voo devolveria ao pool uma conexão suja.
  const query = client
    .query("select 1")
    .then(() => "ok" as const)
    .catch((error: unknown) => {
      console.error("[api/health] Ping ao banco falhou.", error);
      return "error" as const;
    })
    .finally(() => client.release());

  let queryTimer: NodeJS.Timeout | undefined;
  const queryTimeout = new Promise<"timeout">((resolve) => {
    queryTimer = setTimeout(() => resolve("timeout"), DB_QUERY_TIMEOUT_MS);
  });

  try {
    const outcome = await Promise.race([query, queryTimeout]);
    if (outcome === "ok") {
      return { status: "ok", latencyMs: Date.now() - startedAt };
    }
    // `timeout` aqui pode ser o banco lento OU o event loop travado
    // atrasando o próprio callback — por isso não é `error` nem 503.
    return { status: outcome === "timeout" ? "timeout" : "error", latencyMs: null };
  } finally {
    if (queryTimer) clearTimeout(queryTimer);
  }
}

/**
 * GET /api/health
 *
 * SEM token → o mínimo indispensável para um healthcheck de plataforma:
 * `{ status: "ok" }` com 200.
 *
 * COM token (`x-health-token`) → uptime, atraso do event loop, contadores do
 * pool e estado do worker. Some `?db=1` para incluir um `select 1`; sem essa
 * flag a rota não toca no banco (ler os contadores do `Pool` é acesso a
 * array em memória, não abre conexão — verificado nos getters do `pg-pool`).
 *
 * POR QUE AS MÉTRICAS SÃO PROTEGIDAS: `waitingCount` e o atraso do event
 * loop são um ORÁCULO DE SATURAÇÃO — publicá-los deixa qualquer um medir,
 * em tempo real, se a carga que ele está gerando está funcionando, e
 * ajustar o ataque por esse feedback.
 *
 * POR QUE O CAMINHO PÚBLICO NUNCA RESPONDE 503 POR LENTIDÃO: se o
 * healthcheck da plataforma falhasse sob carga, o orquestrador mataria
 * justamente o container que está ocupado — transformando uma lentidão
 * temporária em queda, e em crash loop no pior caso. O 503 fica reservado
 * para falha REAL de conexão com o banco, no caminho autenticado com
 * `?db=1`; saturação de pool e timeout respondem 200 com o motivo explícito.
 *
 * ⚠️ O QUE ESTA ROTA NÃO DETECTA: o caminho público é LIVENESS ("o processo
 * aceita HTTP?"), incondicional por desenho. Ele responde 200 mesmo com o
 * app quebrado por outro motivo — em especial MIGRATION QUEBRADA, já que o
 * `CMD` do Dockerfile usa `||` de propósito para o servidor subir mesmo se
 * `scripts/migrate.mjs` falhar (o incidente `42P01 relation "products" does
 * not exist` do techContext teria 200 aqui). Readiness de verdade exigiria
 * um sinal do passo de migração; enquanto não existir, não confie neste
 * endpoint para dizer que o DEPLOY está são — só que o processo está vivo.
 *
 * A resposta NUNCA inclui valor de variável de ambiente, string de conexão
 * ou nome de host — nem no caminho autenticado, nem em mensagem de erro.
 */
export async function GET(request: NextRequest) {
  if (!hasMetricsAccess(request)) {
    return NextResponse.json({ status: "ok" }, { status: 200, headers: NO_STORE });
  }

  const wantsDbPing = request.nextUrl.searchParams.get("db") === "1";
  const database = wantsDbPing ? await pingDatabase() : null;

  // Só falha REAL de conexão reprova o health check. Lentidão, timeout e
  // pool saturado, não.
  const healthy = database === null || database.status !== "error";

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      uptimeSeconds: Math.round(process.uptime()),
      /**
       * Atraso do event loop. Como ler:
       *
       * - `window` é o AGORA (janela curta, zerada por timer). É por ele que
       *   se decide se há incidente: `p90Ms`/`p99Ms` altos = saturação
       *   sustentada, o sintoma que importa (no teste de carga a home foi de
       *   ~20 ms para p90 432 ms sem devolver um único erro HTTP).
       * - `cumulative` é a linha de base desde que o monitor ligou; seu
       *   `maxMs` é o pior engasgo de todos os tempos (monotônico — não serve
       *   para dizer se o problema é agora).
       * - `window.seconds` diz de quanto tempo é a janela lida: valor baixo
       *   significa janela recém-zerada, com poucas amostras.
       *
       * Ver `event-loop-monitor.ts` para a medição que mostra por que o
       * acumulado sozinho fica CEGO depois de algumas horas de uptime.
       */
      eventLoop: readEventLoopDelay(),
      pool: {
        total: dbPool.totalCount,
        idle: dbPool.idleCount,
        /** > 0 significa request esperando conexão livre — sinal de pressão real. */
        waiting: dbPool.waitingCount,
        max: dbPool.options.max ?? DB_POOL_MAX_CONNECTIONS,
      },
      /**
       * Worker BullMQ DESTE processo. `running: false` com
       * `reason: "disabled-by-flag"` e nenhum outro processo consumindo
       * significa fila crescendo em silêncio: o webhook do ERP continua
       * respondendo 202 normalmente. Ver `register-workers.ts`.
       */
      workers: getWorkerRuntimeState(),
      ...(database ? { database } : {}),
    },
    { status: healthy ? 200 : 503, headers: NO_STORE }
  );
}
