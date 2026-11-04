import { element } from '../image-shared/processing';
import type { Size } from '../image-shared/model';

/** The range input is the authority for both the accessible slider and the drag handle. */
export function mountComparison(
  root: HTMLElement,
  dimensions: () => Size | null,
) {
  const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
    element<T>(root, id);
  const stage = $('comparison-stage'),
    scroll = $('comparison-scroll');
  const range = $<HTMLInputElement>('compare-position'),
    handle = $('compare-handle');
  const events = new AbortController();
  let actual = false,
    pointer: number | null = null;
  function split() {
    stage.style.setProperty('--split', `${range.value}%`);
    handle.setAttribute('aria-label', `拖动对比，原图显示 ${range.value}%`);
  }
  function update() {
    const size = dimensions();
    if (!size || !scroll.clientWidth) return;
    const maxHeight = Math.min(window.innerHeight * 0.62, 660);
    const scale = actual
      ? 1
      : Math.min(scroll.clientWidth / size.width, maxHeight / size.height, 1);
    stage.style.width = `${size.width * scale}px`;
    stage.style.height = `${size.height * scale}px`;
    scroll.style.height = `${Math.min(maxHeight, size.height * scale)}px`;
    $('view-fit').setAttribute('aria-pressed', String(!actual));
    $('view-actual').setAttribute('aria-pressed', String(actual));
  }
  function position(event: PointerEvent) {
    const box = stage.getBoundingClientRect();
    range.value = String(
      Math.round(
        Math.min(
          100,
          Math.max(0, ((event.clientX - box.left) / box.width) * 100),
        ),
      ),
    );
    split();
  }
  handle.addEventListener(
    'pointerdown',
    (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      pointer = event.pointerId;
      handle.setPointerCapture(event.pointerId);
      position(event);
    },
    { signal: events.signal },
  );
  handle.addEventListener(
    'pointermove',
    (event) => {
      if (pointer === event.pointerId) position(event);
    },
    { signal: events.signal },
  );
  const finish = () => {
    pointer = null;
  };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
    handle.addEventListener(type, finish, { signal: events.signal });
  handle.addEventListener(
    'keydown',
    (event) => {
      const step: Record<string, number> = {
        ArrowLeft: -1,
        ArrowRight: 1,
        ArrowUp: 1,
        ArrowDown: -1,
      };
      if (!(event.key in step)) return;
      event.preventDefault();
      range.value = String(
        Number(range.value) + step[event.key] * (event.shiftKey ? 10 : 1),
      );
      split();
    },
    { signal: events.signal },
  );
  range.addEventListener('input', split, { signal: events.signal });
  $('view-fit').addEventListener(
    'click',
    () => {
      actual = false;
      update();
    },
    { signal: events.signal },
  );
  $('view-actual').addEventListener(
    'click',
    () => {
      actual = true;
      update();
    },
    { signal: events.signal },
  );
  const observer = new ResizeObserver(update);
  observer.observe(scroll);
  window.addEventListener('resize', update, { signal: events.signal });
  split();
  return {
    update,
    dispose() {
      events.abort();
      observer.disconnect();
      finish();
    },
  };
}
