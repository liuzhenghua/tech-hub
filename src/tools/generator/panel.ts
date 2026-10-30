import { generateRSA, rsaFormats } from './rsa';
import { createCopyFeedback } from '../../copy-feedback';
import markup from './panel.html?raw';
import { mountOptionTabs } from '../shared/option-tabs';
import { icon } from '../shared/icons';
import {
  generateKey,
  generatePassword,
  generateUUIDs,
  passwordGroups,
} from './generate';
import './style.css';

type Results = Record<string, string>;
async function generate(kind: string, data: FormData): Promise<Results> {
  switch (kind) {
    case 'uuid':
      return {
        uuid: generateUUIDs(
          Number(data.get('count')),
          data.has('hyphens'),
          data.has('uppercase'),
        ),
      };
    case 'key':
      return {
        key: generateKey(
          Number(data.get('bytes')),
          String(data.get('encoding')),
        ),
      };
    case 'password':
      return {
        password: generatePassword(
          Number(data.get('length')),
          Object.entries(passwordGroups)
            .filter(([key]) => data.has(key))
            .map(([, chars]) => chars),
        ),
      };
    case 'rsa': {
      const pair = await generateRSA(
        Number(data.get('bits')),
        String(data.get('rsa-format')),
      );
      return { public: pair.publicKey, private: pair.privateKey };
    }
    default:
      throw Error('不支持的生成类型');
  }
}
export function mountGenerator(root: HTMLElement): () => void {
  root.innerHTML = markup;
  const events = new AbortController();
  const copyFeedback = createCopyFeedback();
  let disposed = false;
  const select = root.querySelector<HTMLSelectElement>('#generator-kind')!;
  const rsaFormat = root.querySelector<HTMLSelectElement>(
    '[name="rsa-format"]',
  )!;
  rsaFormat.replaceChildren(
    ...Object.entries(rsaFormats).map(
      ([value, item]) => new Option(item.label, value),
    ),
  );
  function updateRSAFormat() {
    const format = rsaFormats[rsaFormat.value as keyof typeof rsaFormats];
    root.querySelector('[data-rsa-hint]')!.textContent = format.hint;
    root.querySelector('[data-rsa-public-label]')!.textContent =
      format.publicLabel;
    root.querySelector('[data-rsa-private-label]')!.textContent =
      format.privateLabel;
  }
  rsaFormat.addEventListener('change', updateRSAFormat, {
    signal: events.signal,
  });
  updateRSAFormat();
  const disposeTabs = mountOptionTabs(select);
  const forms = [...root.querySelectorAll<HTMLFormElement>('[data-generator]')];
  const revisions = new Map<HTMLFormElement, number>();
  const output = (key: string) =>
    root.querySelector<HTMLTextAreaElement>('#generator-output-' + key)!;
  function message(form: HTMLFormElement, text: string, failed = false) {
    const status = form.querySelector<HTMLElement>('.generator-status')!;
    status.textContent = text;
    status.classList.toggle('error', failed);
  }
  function invalidate(form: HTMLFormElement) {
    for (const button of form.querySelectorAll<HTMLButtonElement>(
      '[data-copy]',
    ))
      copyFeedback.reset(button);
    revisions.set(form, (revisions.get(form) || 0) + 1);
    form.querySelector<HTMLButtonElement>('[type="submit"]')!.disabled = false;
    form.removeAttribute('aria-busy');
    for (const area of form.querySelectorAll('textarea')) area.value = '';
    for (const button of form.querySelectorAll<HTMLButtonElement>(
      '[data-copy]',
    ))
      button.disabled = true;
    message(form, '');
  }
  async function run(form: HTMLFormElement) {
    invalidate(form);
    const revision = revisions.get(form);
    const submit = form.querySelector<HTMLButtonElement>('[type="submit"]')!;
    submit.disabled = true;
    form.setAttribute('aria-busy', 'true');
    message(form, '正在生成…');
    try {
      const result = await generate(
        form.dataset.generator!,
        new FormData(form),
      );
      if (disposed || revision !== revisions.get(form)) return;
      for (const [key, value] of Object.entries(result))
        output(key).value = value;
      for (const button of form.querySelectorAll<HTMLButtonElement>(
        '[data-copy]',
      ))
        button.disabled = false;
      message(form, '已生成');
    } catch (error) {
      if (!disposed && revision === revisions.get(form))
        message(
          form,
          error instanceof Error
            ? error.message
            : '生成失败，请检查浏览器是否支持 Web Crypto。',
          true,
        );
    } finally {
      if (!disposed && revision === revisions.get(form)) {
        submit.disabled = false;
        form.removeAttribute('aria-busy');
      }
    }
  }
  async function copy(button: HTMLButtonElement, form: HTMLFormElement) {
    const revision = revisions.get(form);
    try {
      await navigator.clipboard.writeText(output(button.dataset.copy!).value);
      if (!disposed && revision === revisions.get(form))
        copyFeedback.show(button);
    } catch {
      if (!disposed && revision === revisions.get(form))
        message(form, '复制失败，请手动选中结果复制。', true);
    }
  }
  for (const form of forms) {
    form.querySelector('[type="submit"]')!.prepend(icon('refresh'));
    form.addEventListener(
      'submit',
      (event) => {
        event.preventDefault();
        void run(form);
      },
      { signal: events.signal },
    );
    form.addEventListener('input', () => invalidate(form), {
      signal: events.signal,
    });
    for (const button of form.querySelectorAll<HTMLButtonElement>(
      '[data-copy]',
    )) {
      button.prepend(icon('copy'));
      button.addEventListener('click', () => void copy(button, form), {
        signal: events.signal,
      });
    }
  }
  select.addEventListener(
    'change',
    () => {
      for (const form of forms)
        form.hidden = form.dataset.generator !== select.value;
    },
    { signal: events.signal },
  );
  return () => {
    disposed = true;
    copyFeedback.dispose();
    events.abort();
    disposeTabs();
    root.replaceChildren();
  };
}
