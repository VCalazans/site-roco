/**
 * Gera a base de estados, regiões e cidades usada na "área de atuação" do
 * representante, a partir da API de localidades do IBGE. Reprodutível: rode de
 * novo quando o IBGE criar ou renomear municípios.
 *
 *   node scripts/build-ibge-localidades.mjs
 *
 * Fonte (dados públicos do IBGE):
 *   https://servicodados.ibge.gov.br/api/v1/localidades/estados
 *   https://servicodados.ibge.gov.br/api/v1/localidades/mesorregioes
 *   https://servicodados.ibge.gov.br/api/v1/localidades/municipios
 *
 * Saída: src/shared/data/ibge-localidades.json — versionado no repositório, para
 * o site não depender da API do IBGE no ar. Formato compacto (tuplas):
 *   states:  [sigla, nome]                    ex.: ["SC", "Santa Catarina"]
 *   regions: [id da mesorregião, nome, UF]    ex.: [4204, "Vale do Itajaí", "SC"]
 *   cities:  [id do município, nome, UF]      ex.: [4202404, "Blumenau", "SC"]
 *
 * "Regiões" são as MESORREGIÕES do IBGE ("Vale do Itajaí", "Oeste Catarinense"),
 * os nomes que o comercial já usa para descrever território. A UF do município
 * vem da mesorregião ou, na falta dela (municípios criados depois de 2017, como
 * Boa Esperança do Norte/MT), da região imediata.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const API = "https://servicodados.ibge.gov.br/api/v1/localidades";
const OUT = "src/shared/data/ibge-localidades.json";

async function fetchJson(path) {
  const response = await fetch(`${API}/${path}`, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`IBGE ${path}: HTTP ${response.status}`);
  return response.json();
}

const byName = (a, b) => a[1].localeCompare(b[1], "pt-BR");

const [estados, mesorregioes, municipios] = await Promise.all([
  fetchJson("estados"),
  fetchJson("mesorregioes"),
  fetchJson("municipios"),
]);

const states = estados.map((estado) => [estado.sigla, estado.nome]).sort(byName);
const regions = mesorregioes.map((meso) => [meso.id, meso.nome, meso.UF.sigla]).sort(byName);
const cities = municipios
  .map((municipio) => {
    const uf =
      municipio.microrregiao?.mesorregiao?.UF?.sigla ??
      municipio["regiao-imediata"]?.["regiao-intermediaria"]?.UF?.sigla;
    if (!uf) throw new Error(`Município sem UF: ${municipio.id} ${municipio.nome}`);
    return [municipio.id, municipio.nome, uf];
  })
  .sort(byName);

if (states.length !== 27) throw new Error(`Esperados 27 estados, vieram ${states.length}`);
if (cities.length < 5500) throw new Error(`Poucos municípios: ${cities.length}`);

const data = {
  source: "IBGE — API de localidades (servicodados.ibge.gov.br/api/v1/localidades)",
  retrievedAt: new Date().toISOString().slice(0, 10),
  states,
  regions,
  cities,
};

mkdirSync(dirname(OUT), { recursive: true });
// Uma tupla por linha: o diff de uma atualização do IBGE fica legível.
const lines = (rows) => rows.map((row) => `    ${JSON.stringify(row)}`).join(",\n");
writeFileSync(
  OUT,
  `{
  "source": ${JSON.stringify(data.source)},
  "retrievedAt": ${JSON.stringify(data.retrievedAt)},
  "states": [
${lines(states)}
  ],
  "regions": [
${lines(regions)}
  ],
  "cities": [
${lines(cities)}
  ]
}
`
);
console.log(`${OUT}: ${states.length} estados, ${regions.length} regiões, ${cities.length} municípios.`);
