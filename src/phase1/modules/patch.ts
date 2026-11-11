// Patch (docs/design/patch.md)
// Diff 결과를 받아 실제 영역의 DOM에서 바뀐 노드만 고쳐요 (FR-E04, W14)
// - Diff 결과의 i번째 칸 = 부모 DOM의 i번째 자식 노드로 위치를 맞춰요
// - key로 짝지은 결과(KEYED)는 칸이 가리키는 이전 노드를 고친 뒤, 새 순서대로 insertBefore로 배치해요 (ADR-011)
// - 재귀로 내려가고, 칸은 for 반복문으로 돌아요 (ADR-009)

import type { ChildPatches, KeyedPatches, Patch } from './diff';
import { toDOM } from './vdom';

/**
 * parent의 자식 목록에 Diff 결과를 적용해요.
 * 처음에는 실제 영역 컨테이너와 diff의 반환값을 넣어요.
 *
 * 전제 조건: parent의 자식 목록이 Diff의 이전 트리와 같은 모양이어야 해요 (FR-W15).
 * 깨지면 칸에 대응하는 노드가 없어 오류를 던져요.
 */
export function patch(parent: Node, patches: ChildPatches): void {
  if (!Array.isArray(patches)) {
    patchKeyed(parent, patches);
    return;
  }
  // 고치기 전에 복사해 둬요. 앞 칸의 REMOVE가 childNodes를 당겨도 원래 노드를 찾을 수 있어요
  const nodes = Array.from(parent.childNodes);

  // 콜백 대신 for 반복문: 재귀 한 단계마다 쌓이는 호출을 줄여요 (ADR-009 결정 5)
  for (let i = 0; i < patches.length; i++) {
    const p = patches[i];
    if (p === null) continue; // 바뀌지 않은 노드와 그 하위 트리는 건드리지 않아요
    applyPatch(parent, nodes[i], p, i);
  }
}

/**
 * key로 짝지은 결과를 적용해요 (ADR-011).
 * 1. 짝이 없는 이전 노드를 지워요
 * 2. 칸마다 내용을 고치고, 새 노드는 만들어 둬요 (아직 붙이지 않아요)
 * 3. 새 목록을 뒤에서부터 돌며, 새 노드와 이동할 노드만 바로 뒤 노드 앞에 넣어요.
 *    뒤에서부터 넣으므로 기준 노드는 항상 최종 자리에 있어요. 이미 있는 노드를 넣으면 같은 객체가 옮겨져요
 */
function patchKeyed(parent: Node, keyed: KeyedPatches): void {
  const nodes = Array.from(parent.childNodes);

  for (let i = 0; i < keyed.removes.length; i++) {
    const index = keyed.removes[i];
    parent.removeChild(requireNode(nodes[index], { type: 'REMOVE' }, index));
  }

  const placed: Node[] = [];
  for (let i = 0; i < keyed.children.length; i++) {
    const c = keyed.children[i];
    if (c.oldIndex === null) {
      if (c.patch === null || c.patch.type !== 'CREATE') throw new Error(`${i}번째 새 노드에 CREATE가 없어요`);
      placed.push(toDOM(c.patch.vnode));
      continue;
    }
    const node = nodes[c.oldIndex];
    if (c.patch === null) {
      placed.push(requireNode(node, { type: 'REMOVE' }, c.oldIndex));
    } else if (c.patch.type === 'REPLACE') {
      const next = toDOM(c.patch.vnode);
      parent.replaceChild(next, requireNode(node, c.patch, c.oldIndex));
      placed.push(next);
    } else {
      applyPatch(parent, node, c.patch, c.oldIndex);
      placed.push(requireNode(node, c.patch, c.oldIndex));
    }
  }

  let ref: Node | null = null;
  for (let i = keyed.children.length - 1; i >= 0; i--) {
    const c = keyed.children[i];
    const node = placed[i];
    if (c.oldIndex === null || c.move) parent.insertBefore(node, ref);
    ref = node;
  }
}

/** 칸 하나를 DOM에 적용해요. UPDATE면 그 요소의 자식으로 patch를 재귀로 불러요. */
function applyPatch(parent: Node, node: ChildNode | undefined, p: Patch, index: number): void {
  switch (p.type) {
    case 'CREATE':
      // 같은 인덱스끼리 비교해서 CREATE는 이전 자식 수보다 뒤 칸에만 나와요. 끝에 붙이면 위치가 맞아요
      parent.appendChild(toDOM(p.vnode));
      return;

    case 'REMOVE':
      parent.removeChild(requireNode(node, p, index));
      return;

    case 'REPLACE':
      parent.replaceChild(toDOM(p.vnode), requireNode(node, p, index));
      return;

    case 'TEXT':
      // 텍스트와 주석 모두 nodeValue로 고쳐요. 노드 객체는 그대로예요
      requireNode(node, p, index).nodeValue = p.text;
      return;

    case 'UPDATE': {
      // 요소 객체는 그대로 두고 속성과 자식만 고쳐요
      const element = requireNode(node, p, index) as Element;
      for (const [name, value] of Object.entries(p.props.set)) {
        element.setAttribute(name, value);
      }
      for (let i = 0; i < p.props.remove.length; i++) {
        element.removeAttribute(p.props.remove[i]);
      }
      patch(element, p.children); // 재귀
      return;
    }
  }
}

/** 칸에 대응하는 DOM 노드를 돌려줘요. 없으면 전제 조건(FR-W15)이 깨진 것이라 오류를 던져요. */
function requireNode(node: ChildNode | undefined, p: Patch, index: number): ChildNode {
  if (node === undefined) {
    throw new Error(
      `${p.type}를 적용할 ${index}번째 자식 노드가 없어요. 실제 영역이 현재 기록의 vdom과 달라요 (FR-W15)`,
    );
  }
  return node;
}
