import type { Crop, Size } from '../image-shared/model';
export interface Point {
  x: number;
  y: number;
}
export type Handle = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';
const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));
export function boundedCrop(rect: Crop, bounds: Size): Crop {
  if (!Object.values(rect).every(Number.isFinite))
    throw Error('裁剪坐标和尺寸必须是有效数字。');
  const width = clamp(rect.width, 1, bounds.width),
    height = clamp(rect.height, 1, bounds.height);
  return {
    x: clamp(rect.x, 0, bounds.width - width),
    y: clamp(rect.y, 0, bounds.height - height),
    width,
    height,
  };
}
export function centeredCrop(bounds: Size, ratio = 0): Crop {
  if (!Number.isFinite(ratio) || ratio < 0) throw Error('裁剪比例无效。');
  const width = ratio
    ? Math.min(bounds.width, bounds.height * ratio)
    : bounds.width;
  const height = ratio ? width / ratio : bounds.height;
  return {
    x: (bounds.width - width) / 2,
    y: (bounds.height - height) / 2,
    width,
    height,
  };
}
export function moveCrop(
  rect: Crop,
  dx: number,
  dy: number,
  bounds: Size,
): Crop {
  return boundedCrop({ ...rect, x: rect.x + dx, y: rect.y + dy }, bounds);
}
export function drawCrop(
  start: Point,
  end: Point,
  bounds: Size,
  ratio = 0,
): Crop {
  const x = clamp(end.x, 0, bounds.width),
    y = clamp(end.y, 0, bounds.height);
  let width = Math.max(1, Math.abs(x - start.x)),
    height = Math.max(1, Math.abs(y - start.y));
  if (ratio) {
    width = Math.min(width, height * ratio);
    height = width / ratio;
  }
  return boundedCrop(
    {
      x: x < start.x ? start.x - width : start.x,
      y: y < start.y ? start.y - height : start.y,
      width,
      height,
    },
    bounds,
  );
}
const directions: Record<Handle, [number, number]> = {
  n: [0, -1],
  s: [0, 1],
  e: [1, 0],
  w: [-1, 0],
  nw: [-1, -1],
  ne: [1, -1],
  sw: [-1, 1],
  se: [1, 1],
};
function anchor(start: number, length: number, direction: number) {
  if (direction < 0) return start + length;
  if (direction > 0) return start;
  return start + length / 2;
}
function available(point: number, limit: number, direction: number) {
  if (!direction) return 2 * Math.min(point, limit - point);
  return direction < 0 ? point : limit - point;
}
function origin(point: number, length: number, direction: number) {
  if (direction < 0) return point - length;
  return direction > 0 ? point : point - length / 2;
}
function desiredWidth(requested: Crop, sx: number, sy: number, ratio: number) {
  if (!sx) return requested.height * ratio;
  if (!sy) return requested.width;
  return Math.min(requested.width, requested.height * ratio);
}
function ratioResize(
  rect: Crop,
  requested: Crop,
  handle: Handle,
  bounds: Size,
  ratio: number,
): Crop {
  const [sx, sy] = directions[handle];
  const ax = anchor(rect.x, rect.width, sx),
    ay = anchor(rect.y, rect.height, sy);
  const width = Math.min(
    Math.max(1, desiredWidth(requested, sx, sy, ratio)),
    available(ax, bounds.width, sx),
    available(ay, bounds.height, sy) * ratio,
  );
  const height = width / ratio;
  return { x: origin(ax, width, sx), y: origin(ay, height, sy), width, height };
}
export function resizeCrop(
  rect: Crop,
  handle: Handle,
  dx: number,
  dy: number,
  bounds: Size,
  ratio = 0,
): Crop {
  const left = handle.includes('w')
    ? clamp(rect.x + dx, 0, rect.x + rect.width - 1)
    : rect.x;
  const top = handle.includes('n')
    ? clamp(rect.y + dy, 0, rect.y + rect.height - 1)
    : rect.y;
  const right = handle.includes('e')
    ? clamp(rect.x + rect.width + dx, left + 1, bounds.width)
    : rect.x + rect.width;
  const bottom = handle.includes('s')
    ? clamp(rect.y + rect.height + dy, top + 1, bounds.height)
    : rect.y + rect.height;
  const requested = {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
  return ratio
    ? ratioResize(rect, requested, handle, bounds, ratio)
    : requested;
}
export function editCrop(
  rect: Crop,
  key: keyof Crop,
  value: number,
  bounds: Size,
  ratio = 0,
): Crop {
  const next = { ...rect, [key]: value };
  if (ratio && key === 'width') next.height = value / ratio;
  if (ratio && key === 'height') next.width = value * ratio;
  if (ratio && (key === 'width' || key === 'height')) {
    const scale = Math.min(
      1,
      bounds.width / next.width,
      bounds.height / next.height,
    );
    next.width *= scale;
    next.height *= scale;
  }
  return boundedCrop(next, bounds);
}
export function pixelCrop(rect: Crop, bounds: Size): Crop {
  const safe = boundedCrop(rect, bounds);
  const x = Math.min(bounds.width - 1, Math.round(safe.x)),
    y = Math.min(bounds.height - 1, Math.round(safe.y));
  return {
    x,
    y,
    width: Math.min(bounds.width - x, Math.max(1, Math.round(safe.width))),
    height: Math.min(bounds.height - y, Math.max(1, Math.round(safe.height))),
  };
}
