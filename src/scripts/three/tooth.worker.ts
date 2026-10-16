/// <reference lib="webworker" />
/**
 * Worker que gera a geometria do dente fora da thread principal.
 * Envia primeiro uma versão rápida (célula maior) e, se pedido, uma
 * versão refinada logo depois.
 */
import { buildTooth, type MeshData, type ToothData } from './geometry/tooth-builder';

function transferables(d: ToothData): Transferable[] {
  const out: Transferable[] = [];
  const add = (m: MeshData) => out.push(m.positions.buffer, m.normals.buffer, m.colors.buffer, m.indices.buffer);
  Object.values(d.whole).forEach(add);
  Object.values(d.cut).forEach(add);
  Object.values(d.quarter).forEach(add);
  Object.values(d.crowns).forEach(add);
  return out;
}

self.onmessage = (e: MessageEvent<{ cells: number[] }>) => {
  for (const cell of e.data.cells) {
    const data = buildTooth({ cell });
    (self as unknown as Worker).postMessage({ cell, data }, transferables(data));
  }
};
