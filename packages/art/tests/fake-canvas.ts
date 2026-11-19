// A recording stand-in for a 2D canvas (node has none): every call and style is logged, image data is a buffer.
export function fakeSurface(w: number, h: number) {
  const log: string[] = [];
  const data = new Uint8ClampedArray(w * h * 4);
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(_t, k: string) {
      if (k === 'getImageData') return () => ({ data, width: w, height: h });
      if (k === 'putImageData') return () => { log.push('put'); };
      return (...a: unknown[]) => { log.push(k + '(' + a.map((x) => (typeof x === 'number' ? Math.round(x * 100) / 100 : String(x))).join(',') + ')'); };
    },
    set(_t, k: string, v: unknown) { log.push(k + '=' + String(v)); return true; },
  });
  return { canvas: { width: w, height: h } as unknown as CanvasImageSource & { width: number; height: number }, ctx: ctx as never, log, data };
}
