import type { Crop, Size } from '../image-shared/model';
import {
  drawCrop,
  moveCrop,
  resizeCrop,
  type Handle,
  type Point,
} from './geometry';
export function mountSelection(
  stage: HTMLElement,
  selection: HTMLElement,
  state: () => { crop: Crop; bounds: Size; ratio: number } | null,
  update: (crop: Crop) => void,
) {
  const events = new AbortController();
  let drag: {
    id: number;
    start: Point;
    crop: Crop;
    bounds: Size;
    handle: Handle | 'move' | 'draw';
  } | null = null;
  function point(event: PointerEvent, bounds: Size): Point {
    const rect = stage.getBoundingClientRect();
    return {
      x: Math.min(
        bounds.width,
        Math.max(0, ((event.clientX - rect.left) / rect.width) * bounds.width),
      ),
      y: Math.min(
        bounds.height,
        Math.max(0, ((event.clientY - rect.top) / rect.height) * bounds.height),
      ),
    };
  }
  stage.addEventListener(
    'pointerdown',
    (event) => {
      const current = state();
      if (!current || event.button !== 0 || !(event.target instanceof Element))
        return;
      event.preventDefault();
      const handle = event.target.closest<HTMLElement>('[data-handle]')?.dataset
        .handle as Handle | undefined;
      drag = {
        id: event.pointerId,
        start: point(event, current.bounds),
        crop: { ...current.crop },
        bounds: current.bounds,
        handle: handle || (selection.contains(event.target) ? 'move' : 'draw'),
      };
      stage.setPointerCapture(event.pointerId);
      stage.classList.add('is-dragging');
      selection.focus({ preventScroll: true });
    },
    { signal: events.signal },
  );
  stage.addEventListener(
    'pointermove',
    (event) => {
      const current = state();
      if (!drag || drag.id !== event.pointerId) return;
      if (!current || drag.bounds !== current.bounds) return finish();
      const end = point(event, current.bounds),
        dx = end.x - drag.start.x,
        dy = end.y - drag.start.y;
      if (drag.handle === 'draw')
        update(drawCrop(drag.start, end, current.bounds, current.ratio));
      else if (drag.handle === 'move')
        update(moveCrop(drag.crop, dx, dy, current.bounds));
      else
        update(
          resizeCrop(
            drag.crop,
            drag.handle,
            dx,
            dy,
            current.bounds,
            current.ratio,
          ),
        );
    },
    { signal: events.signal },
  );
  const finish = () => {
    drag = null;
    stage.classList.remove('is-dragging');
  };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
    stage.addEventListener(type, finish, { signal: events.signal });
  selection.addEventListener(
    'keydown',
    (event) => {
      const current = state();
      const direction: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      if (!current || !direction[event.key]) return;
      event.preventDefault();
      const [x, y] = direction[event.key],
        step = event.shiftKey ? 10 : 1;
      const handle = (event.target as HTMLElement).dataset.handle as
        Handle | undefined;
      update(
        handle
          ? resizeCrop(
              current.crop,
              handle,
              x * step,
              y * step,
              current.bounds,
              current.ratio,
            )
          : moveCrop(current.crop, x * step, y * step, current.bounds),
      );
    },
    { signal: events.signal },
  );
  return () => {
    finish();
    events.abort();
  };
}
