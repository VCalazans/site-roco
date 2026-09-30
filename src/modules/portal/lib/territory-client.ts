"use client";

import { useEffect, useState } from "react";
import { buildTerritoryIndex, type IbgeLocalities, type TerritoryIndex } from "@/shared/lib/territory";

let pending: Promise<TerritoryIndex> | null = null;

/**
 * Base de estados, regiões e cidades do IBGE, carregada SOB DEMANDA: é um
 * pedaço separado do bundle (~200 KB, ~57 KB comprimido) que só desce quando
 * um campo de área de atuação aparece — e uma vez só por página.
 */
export function loadTerritoryIndex(): Promise<TerritoryIndex> {
  pending ??= import("@/shared/data/ibge-localidades.json")
    .then((module) => buildTerritoryIndex((module.default ?? module) as IbgeLocalities))
    .catch((error: unknown) => {
      pending = null; // falhou (rede): a próxima montagem tenta de novo
      throw error;
    });
  return pending;
}

/** Índice da base para os componentes; `failed` quando o download falhou. */
export function useTerritoryIndex(): { index: TerritoryIndex | null; failed: boolean } {
  const [state, setState] = useState<{ index: TerritoryIndex | null; failed: boolean }>({ index: null, failed: false });

  useEffect(() => {
    let alive = true;
    loadTerritoryIndex().then(
      (index) => {
        if (alive) setState({ index, failed: false });
      },
      () => {
        if (alive) setState({ index: null, failed: true });
      }
    );
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
