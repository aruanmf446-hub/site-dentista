/// <reference lib="webworker" />
/**
 * Worker que gera a geometria do dente fora da thread principal.
 * Envia primeiro só a casca (o dente do hero), depois a versão rápida
 * completa (célula maior) e, se pedido, uma versão refinada.
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

self.onmessage = (e: MessageEvent<{ jobs: { cell: number; shellOnly?: boolean }[] }>) => {
  for (const job of e.data.jobs) {
    const data = buildTooth(job);
    (self as unknown as Worker).postMessage({ cell: job.cell, data }, transferables(data));
  }
};
