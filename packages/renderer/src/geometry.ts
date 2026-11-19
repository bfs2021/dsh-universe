// The isometric grid in art pixels: a ground tile is 32×16 art pixels; heights are in drawing
// units (two units = one art pixel; a storey outside is 11 units).
export const ART_SCALE = 0.5;
/** Tile (x, y) at height z (drawing units) → art pixel, rounded to whole pixels. */
export const artXY = (x: number, y: number, z = 0): [number, number] => [Math.round((x - y) * 16), Math.round((x + y) * 8 - z * ART_SCALE)];
/** Zoom levels: only these, never anything in between. */
export const ZOOM_LEVELS = [0.25, 0.5, 1, 2, 3, 4] as const;
