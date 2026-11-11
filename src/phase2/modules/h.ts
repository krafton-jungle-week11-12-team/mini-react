// h 함수 (docs/design/phase2/h.md)
// h(tag, props, ...children) 호출을 VNode로 바꿔요. tag가 함수(자식 컴포넌트)면 바로 실행해요 (FR-H01~H09)
import type { VElement, VNode } from '../../phase1/modules/vdom';

export type Child = VNode | string | number | boolean | null | undefined | Child[];

export function h(tag: string, props: Record<string, unknown> | null, ...children: Child[]): VElement;
export function h<P extends object>(
  tag: (props: P & { children: VNode[] }) => VNode,
  props: P | null,
  ...children: Child[]
): VNode;
export function h(
  tag: string | ((props: Record<string, unknown>) => VNode),
  props: Record<string, unknown> | null,
  ...children: Child[]
): VNode {
  const kids = normalizeChildren(children);
  // key는 Diff가 짝을 찾을 때만 쓰는 표시라 props에서 떼어 VNode의 key 필드로 옮겨요 (FR-H08, H09)
  const { key, ...rest } = props ?? {};
  const keyText = key === null || key === undefined ? undefined : String(key);

  if (typeof tag === 'function') {
    const result = tag({ ...rest, children: kids });
    if (keyText !== undefined && result.kind === 'element') result.key = keyText;
    return result;
  }

  const vnode: VElement = { kind: 'element', tag, props: rest as Record<string, string>, children: kids };
  if (keyText !== undefined) vnode.key = keyText;
  return vnode;
}

/** 배열을 펼치고, 조건부 렌더링 값을 버리고, 문자열·숫자를 텍스트 VNode로 바꿔요 (FR-H03~H05, H07) */
function normalizeChildren(children: Child[]): VNode[] {
  const result: VNode[] = [];
  for (const child of children) {
    if (Array.isArray(child)) result.push(...normalizeChildren(child));
    else if (child === null || child === undefined || typeof child === 'boolean') continue;
    else if (typeof child === 'string' || typeof child === 'number') result.push({ kind: 'text', text: String(child) });
    else result.push(child);
  }
  return result;
}
