import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateImageFile,
  validateSize,
  fitSize,
  outputName,
  reduction,
} from '../src/tools/image-shared/model';
import {
  boundedCrop,
  centeredCrop,
  drawCrop,
  editCrop,
  moveCrop,
  pixelCrop,
  resizeCrop,
  type Handle,
} from '../src/tools/image-crop/geometry';
const bounds = { width: 1672, height: 941 };
function inside(rect: { x: number; y: number; width: number; height: number }) {
  assert.ok(rect.x >= -1e-8 && rect.y >= -1e-8);
  assert.ok(rect.width > 0 && rect.height > 0);
  assert.ok(rect.x + rect.width <= bounds.width + 1e-8);
  assert.ok(rect.y + rect.height <= bounds.height + 1e-8);
}
test('image inputs reject unsupported files, empty content and excessive decoding dimensions', () => {
  validateImageFile({ type: 'image/png', size: 1024 });
  for (const file of [
    { type: 'image/svg+xml', size: 10 },
    { type: 'image/png', size: 0 },
    { type: 'image/png', size: 31 * 1024 * 1024 },
  ])
    assert.throws(() => validateImageFile(file));
  validateSize(bounds);
  for (const size of [
    { width: 0, height: 100 },
    { width: NaN, height: 10 },
    { width: 9000, height: 1 },
    { width: 6000, height: 6000 },
  ])
    assert.throws(() => validateSize(size));
});
test('resizing preserves aspect ratio, never upscales and keeps extreme narrow images nonzero', () => {
  assert.deepEqual(fitSize(bounds, 1280), { width: 1280, height: 720 });
  assert.deepEqual(fitSize(bounds, 9000), bounds);
  assert.deepEqual(fitSize({ width: 1, height: 8192 }, 1), {
    width: 1,
    height: 1,
  });
  for (const edge of [0, NaN, Infinity, -1])
    assert.throws(() => fitSize(bounds, edge));
  assert.equal(
    outputName('a.b.PNG', 'compressed', 'image/webp'),
    'a.b-compressed.webp',
  );
  assert.equal(reduction(100, 10), 90);
  assert.equal(reduction(100, 120), -19.999999999999996);
});
test('centered ratio selection and numeric edits stay within the image', () => {
  for (const ratio of [0, 1, 4 / 3, 16 / 9, 3 / 4, 9 / 16]) {
    const crop = centeredCrop(bounds, ratio);
    inside(crop);
    if (ratio) assert.ok(Math.abs(crop.width / crop.height - ratio) < 1e-8);
    const edited = editCrop(crop, 'width', 4000, bounds, ratio);
    inside(edited);
    if (ratio) assert.ok(Math.abs(edited.width / edited.height - ratio) < 1e-8);
    inside(editCrop(crop, 'x', 9000, bounds, ratio));
  }
  assert.throws(() =>
    boundedCrop({ x: NaN, y: 0, width: 100, height: 100 }, bounds),
  );
});
test('dragging and resizing all eight handles respects bounds and opposite anchors', () => {
  const crop = { x: 200, y: 150, width: 400, height: 300 };
  const handles: Handle[] = ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'];
  for (const handle of handles) {
    for (const delta of [-10000, -20, 20, 10000]) {
      inside(resizeCrop(crop, handle, delta, delta, bounds));
      const fixed = resizeCrop(crop, handle, delta, delta, bounds, 4 / 3);
      inside(fixed);
      assert.ok(Math.abs(fixed.width / fixed.height - 4 / 3) < 1e-8);
    }
  }
  assert.deepEqual(moveCrop(crop, -500, -500, bounds), { ...crop, x: 0, y: 0 });
  const resized = resizeCrop(crop, 'nw', 40, 30, bounds, 4 / 3);
  assert.equal(resized.x + resized.width, 600);
  assert.equal(resized.y + resized.height, 450);
});
test('drawing in every direction and pixel rounding cannot export outside the source', () => {
  const start = { x: 500, y: 500 };
  for (const end of [
    { x: -50, y: -100 },
    { x: 9000, y: 9000 },
    { x: 250, y: 750 },
    { x: 750, y: 250 },
  ]) {
    const rect = drawCrop(start, end, bounds, 16 / 9);
    inside(rect);
    assert.ok(Math.abs(rect.width / rect.height - 16 / 9) < 1e-8);
    const pixels = pixelCrop(rect, bounds);
    inside(pixels);
    assert.ok(Object.values(pixels).every(Number.isInteger));
  }
  assert.deepEqual(
    pixelCrop({ x: 1671.8, y: 940.8, width: 1, height: 1 }, bounds),
    { x: 1671, y: 940, width: 1, height: 1 },
  );
});
