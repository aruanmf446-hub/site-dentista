/**
 * Geometria do dente (sem navegador): a casca lisa não pode ter triângulos
 * dobrados — na borda lateral eles apareciam como um pontilhado na silhueta.
 */
import { test, expect } from '@playwright/test';
import { buildTooth, type MeshData } from '../../src/scripts/three/geometry/tooth-builder';

/** triângulos cuja face aponta contra a normal dos vértices */
function invertidos(m: MeshData): number {
  const P = m.positions,
    N = m.normals,
    I = m.indices;
  let n = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t]!,
      b = I[t + 1]!,
      c = I[t + 2]!;
    const ux = P[3 * b]! - P[3 * a]!,
      uy = P[3 * b + 1]! - P[3 * a + 1]!,
      uz = P[3 * b + 2]! - P[3 * a + 2]!;
    const vx = P[3 * c]! - P[3 * a]!,
      vy = P[3 * c + 1]! - P[3 * a + 1]!,
      vz = P[3 * c + 2]! - P[3 * a + 2]!;
    const fx = uy * vz - uz * vy,
      fy = uz * vx - ux * vz,
      fz = ux * vy - uy * vx;
    const nx = N[3 * a]! + N[3 * b]! + N[3 * c]!,
      ny = N[3 * a + 1]! + N[3 * b + 1]! + N[3 * c + 1]!,
      nz = N[3 * a + 2]! + N[3 * b + 2]! + N[3 * c + 2]!;
    if (fx * nx + fy * ny + fz * nz < 0) n++;
  }
  return n;
}

test.describe('geometria do dente', () => {
  for (const cell of [0.016, 0.0105]) {
    test(`casca sem triângulos dobrados (célula ${cell})`, () => {
      test.setTimeout(60_000);
      const d = buildTooth({ cell });
      expect(invertidos(d.whole.shell)).toBe(0);
    });
  }
});
