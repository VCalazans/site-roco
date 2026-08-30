import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * Compara dois segredos em tempo constante, tolerante a tamanhos
 * diferentes.
 *
 * `crypto.timingSafeEqual` LANÇA quando os buffers têm tamanhos
 * diferentes, então a checagem de tamanho é inevitável — mas um
 * `return false` cru nela vazaria o comprimento do segredo esperado pelo
 * tempo de resposta. Por isso o caminho "tamanhos diferentes" ainda paga
 * uma comparação real (contra um buffer zerado do mesmo tamanho) antes de
 * recusar.
 *
 * Usado por toda rota que valide segredo compartilhado vindo de header
 * (webhook do ERP, token de métricas do health check). Sempre reaproveite
 * esta função: uma comparação com `===` em qualquer uma dessas rotas
 * reintroduz o vazamento por timing.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) {
    timingSafeEqual(bufferA, Buffer.alloc(bufferA.length));
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}
