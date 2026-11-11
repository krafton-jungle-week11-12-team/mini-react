// 입력 걸러내기 (docs/design/phase1/sanitize.md, ADR-014)
// 사용자가 입력한 HTML 코드로 만든 Virtual DOM 트리에서 허용 목록 밖의 요소 노드와 속성을 빼요.
// - 허용하는 것은 레이아웃만 바꾸는 요소와 속성이에요. 스크립트, 페이지 이동, 외부 요청, 페이지 전체에 영향을 주는 것은 모두 빠져요
// - 받은 트리는 고치지 않고 새 트리를 돌려줘요
// - 자식은 for 반복문으로 돌아요 (ADR-009 결정 5)

import type { VElement, VNode } from '../modules/vdom';

/** 허용하는 요소 노드의 태그 이름(localName)이에요. 여기 없는 요소 노드는 자식까지 통째로 빠져요. */
export const ALLOWED_TAGS: ReadonlySet<string> = new Set([
  // 구획
  'div', 'span', 'p', 'br', 'hr', 'section', 'article', 'header', 'footer', 'nav', 'main', 'aside', 'address',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'figure', 'figcaption', 'details', 'summary',
  // 목록
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  // 표
  'table', 'caption', 'colgroup', 'col', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  // 글자
  'pre', 'code', 'kbd', 'samp', 'var', 'strong', 'em', 'b', 'i', 'u', 's', 'small', 'mark', 'sub', 'sup',
  'abbr', 'cite', 'q', 'del', 'ins', 'time',
  // 입력 요소 (form 없이 써서 제출되지 않아요)
  'button', 'label', 'input', 'textarea', 'select', 'option', 'optgroup', 'fieldset', 'legend', 'progress', 'meter',
]);

/** 허용하는 속성 이름이에요. `aria-`, `data-`로 시작하는 속성도 허용해요. `on`으로 시작하는 속성은 여기 없어 빠져요. */
export const ALLOWED_ATTRS: ReadonlySet<string> = new Set([
  // 모든 요소
  'id', 'class', 'style', 'title', 'lang', 'dir', 'hidden', 'role', 'key',
  // 표, 목록
  'colspan', 'rowspan', 'span', 'scope', 'headers', 'start', 'reversed',
  // 입력 요소
  'type', 'value', 'placeholder', 'checked', 'disabled', 'readonly', 'selected', 'multiple',
  'rows', 'cols', 'size', 'min', 'max', 'step', 'maxlength', 'minlength', 'label', 'for',
  'low', 'high', 'optimum',
  // 그 밖
  'open', 'datetime',
]);

/**
 * style 속성 값에 이 패턴이 있으면 속성을 빼요.
 * url()과 image()는 외부 요청을 보내요. 역슬래시는 CSS 이스케이프로 `u\72 l(`처럼 url을 숨길 수 있어서 막아요.
 */
const BLOCKED_STYLE = /url\s*\(|image\s*\(|image-set\s*\(|\\/i;

export type SanitizeResult = {
  /** 허용 목록 밖의 요소 노드와 속성을 뺀 새 트리예요. */
  roots: VNode[];
  /** 뺀 것의 이름이에요. 요소 노드는 `<script>`, 속성은 `onclick`처럼 써요. 처음 나온 순서이고 겹치지 않아요. */
  removed: string[];
};

/** Virtual DOM 트리에서 허용 목록 밖의 요소 노드와 속성을 빼요. */
export function sanitize(roots: VNode[]): SanitizeResult {
  const removed = new Set<string>();
  return { roots: sanitizeList(roots, removed), removed: [...removed] };
}

function sanitizeList(list: VNode[], removed: Set<string>): VNode[] {
  const out: VNode[] = [];
  for (let i = 0; i < list.length; i++) {
    const node = list[i];
    if (node.kind !== 'element') {
      out.push(node); // 텍스트 노드와 주석 노드는 그대로 둬요
      continue;
    }
    if (!ALLOWED_TAGS.has(node.tag)) {
      removed.add(`<${node.tag}>`);
      continue;
    }
    out.push(sanitizeElement(node, removed));
  }
  return out;
}

function sanitizeElement(node: VElement, removed: Set<string>): VElement {
  const props: VElement['props'] = {};
  for (const [name, value] of Object.entries(node.props)) {
    // 입력 HTML에서 온 속성 값은 문자열이에요. 문자열이 아닌 값(함수 등)은 허용하지 않아요
    if (typeof value === 'string' && isAllowedAttr(name, value)) props[name] = value;
    else removed.add(name);
  }
  const clean: VElement = { kind: 'element', tag: node.tag, props, children: sanitizeList(node.children, removed) };
  if (node.key !== undefined) clean.key = node.key;
  return clean;
}

function isAllowedAttr(name: string, value: string): boolean {
  if (name === 'style') return !BLOCKED_STYLE.test(value);
  if (name.startsWith('aria-') || name.startsWith('data-')) return true;
  return ALLOWED_ATTRS.has(name);
}
