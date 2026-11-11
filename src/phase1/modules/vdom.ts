// Virtual DOM 변환 (docs/design/vdom.md)
// - toVNode: 영역 컨테이너 아래의 DOM 트리 → VNode 배열 (FR-E01, E05~E08)
// - toDOM:   VNode 하나 → 새 DOM 노드 (FR-E02). Patch가 새 노드를 만들 때와 검증 페이지가 두 영역을 그릴 때 써요 (ADR-013)
// 두 함수 모두 재귀로 순회하고, 자식은 for 반복문으로 돌아요 (ADR-009)

import { setProp } from '../../phase2/modules/props';

export type VNode = VElement | VText | VComment;

export type VElement = {
  kind: 'element';
  tag: string;
  props: Record<string, string>;
  children: VNode[];
  /** 형제 사이에서 이 노드를 가리키는 이름표. Diff가 짝을 찾을 때만 써요 (ADR-002, ADR-011). DOM 속성으로 만들지 않아요 */
  key?: string;
};

export type VText = {
  kind: 'text';
  text: string;
};

export type VComment = {
  kind: 'comment';
  text: string;
};

/**
 * 영역 컨테이너의 자식 노드들을 VNode 배열로 바꿔요.
 * 컨테이너 자신은 넣지 않아요. 자식이 없으면 `[]`예요.
 * 공백·줄바꿈 텍스트 노드와 주석 노드도 모두 넣어요 (ADR-007).
 */
export function toVNode(container: Element): VNode[] {
  return toVNodeChildren(container);
}

/**
 * VNode 하나를 DOM 노드로 만들어요. 자식까지 모두 만들어요.
 * 만든 노드는 어디에도 붙이지 않고 돌려줘요. 붙이는 건 Patch가 해요.
 */
export function toDOM(vnode: VNode): Node {
  switch (vnode.kind) {
    case 'element': {
      const element = document.createElement(vnode.tag);
      for (const [name, value] of Object.entries(vnode.props)) {
        // 이벤트 핸들러·property·attribute를 나눠 반영해요 (Phase 2 props 설계)
        setProp(element, name, value);
      }
      // 콜백 대신 for 반복문: 재귀 한 단계마다 쌓이는 호출을 줄여요 (ADR-009 결정 5)
      for (let i = 0; i < vnode.children.length; i++) {
        element.appendChild(toDOM(vnode.children[i]));
      }
      return element;
    }
    case 'text':
      return document.createTextNode(vnode.text);
    case 'comment':
      return document.createComment(vnode.text);
  }
}

/** DOM 노드의 자식들을 앞에서부터 VNode로 바꿔 배열로 돌려줘요. */
function toVNodeChildren(parent: Node): VNode[] {
  const result: VNode[] = [];
  const childNodes = parent.childNodes;
  for (let i = 0; i < childNodes.length; i++) {
    const vnode = createVNode(childNodes[i]);
    if (vnode !== null) result.push(vnode);
  }
  return result;
}

/** DOM 노드 하나로 VNode 하나를 만들어요. 요소면 자식까지 재귀로 만들고, 지원하지 않는 종류면 null이에요. */
function createVNode(node: Node): VNode | null {
  switch (node.nodeType) {
    case Node.ELEMENT_NODE: {
      const element = node as Element;
      const props: Record<string, string> = {};
      for (const attribute of Array.from(element.attributes)) {
        props[attribute.name] = attribute.value;
      }
      const vnode: VElement = { kind: 'element', tag: element.localName, props, children: toVNodeChildren(element) };
      // 검증 페이지에서 key 비교를 확인할 수 있게 HTML의 key 속성을 key로 읽어요. 속성은 props에도 그대로 남아요
      const key = element.getAttribute('key');
      if (key !== null) vnode.key = key;
      return vnode;
    }
    case Node.TEXT_NODE:
      return { kind: 'text', text: node.nodeValue ?? '' };
    case Node.COMMENT_NODE:
      return { kind: 'comment', text: node.nodeValue ?? '' };
    default:
      // HTML 파서는 영역 안에 위 세 종류 외의 노드를 만들지 않아요
      return null;
  }
}
