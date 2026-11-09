// Virtual DOM 변환 (docs/design/vdom.md)
// - toVNode: 영역 컨테이너 아래의 DOM 트리 → VNode 배열 (FR-E01, E05~E08)
// - toDOM:   VNode 하나 → 새 DOM 노드 (FR-E02). Patch가 새 노드를 만들 때만 써요 (ADR-004)
// 두 함수 모두 재귀 대신 반복문과 명시적 스택으로 순회해요 (ADR-003)

export type VNode = VElement | VText | VComment;

export type VElement = {
  kind: 'element';
  tag: string;
  props: Record<string, string>;
  children: VNode[];
};

export type VText = {
  kind: 'text';
  text: string;
};

export type VComment = {
  kind: 'comment';
  text: string;
};

/** toVNode 스택 항목: 처리할 DOM 노드와, 만든 VNode를 붙일 곳 */
type ToVNodeTask = {
  node: Node;
  into: VNode[];
};

/** toDOM 스택 항목: 만들 VNode와, 만든 DOM 노드를 붙일 부모 */
type ToDOMTask = {
  vnode: VNode;
  parent: Node;
};

/**
 * 영역 컨테이너의 자식 노드들을 VNode 배열로 바꿔요.
 * 컨테이너 자신은 넣지 않아요. 자식이 없으면 `[]`예요.
 * 공백·줄바꿈 텍스트 노드와 주석 노드도 모두 넣어요 (ADR-007).
 */
export function toVNode(container: Element): VNode[] {
  const result: VNode[] = [];
  const stack: ToVNodeTask[] = [];

  pushChildNodes(stack, container, result);

  while (stack.length > 0) {
    const { node, into } = stack.pop()!;
    const vnode = createVNode(node);
    if (vnode === null) continue;

    // 만들자마자 붙일 곳의 끝에 붙여요
    into.push(vnode);

    if (vnode.kind === 'element') {
      pushChildNodes(stack, node, vnode.children);
    }
  }

  return result;
}

/**
 * VNode 하나를 DOM 노드로 만들어요. 자식까지 모두 만들어요.
 * 만든 노드는 어디에도 붙이지 않고 돌려줘요. 붙이는 건 Patch가 해요.
 */
export function toDOM(vnode: VNode): Node {
  const root = createDOMNode(vnode);
  const stack: ToDOMTask[] = [];

  pushChildVNodes(stack, vnode, root);

  while (stack.length > 0) {
    const { vnode: current, parent } = stack.pop()!;
    const node = createDOMNode(current);

    // 만들자마자 부모의 끝에 붙여요
    parent.appendChild(node);

    pushChildVNodes(stack, current, node);
  }

  return root;
}

/** DOM 노드 하나로 VNode 하나를 만들어요. 자식은 비워 두고, 지원하지 않는 종류면 null이에요. */
function createVNode(node: Node): VNode | null {
  switch (node.nodeType) {
    case Node.ELEMENT_NODE: {
      const element = node as Element;
      const props: Record<string, string> = {};
      for (const attribute of Array.from(element.attributes)) {
        props[attribute.name] = attribute.value;
      }
      return { kind: 'element', tag: element.localName, props, children: [] };
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

/** VNode 하나로 DOM 노드 하나를 만들어요. 요소면 속성까지 붙이고, 자식은 붙이지 않아요. */
function createDOMNode(vnode: VNode): Node {
  switch (vnode.kind) {
    case 'element': {
      const element = document.createElement(vnode.tag);
      for (const [name, value] of Object.entries(vnode.props)) {
        element.setAttribute(name, value);
      }
      return element;
    }
    case 'text':
      return document.createTextNode(vnode.text);
    case 'comment':
      return document.createComment(vnode.text);
  }
}

/** DOM 노드의 자식을 뒤에서부터 스택에 넣어요. 그래야 앞 자식부터 꺼내져요. */
function pushChildNodes(stack: ToVNodeTask[], parent: Node, into: VNode[]): void {
  const childNodes = parent.childNodes;
  for (let i = childNodes.length - 1; i >= 0; i--) {
    stack.push({ node: childNodes[i], into });
  }
}

/** VNode의 자식을 뒤에서부터 스택에 넣어요. 그래야 앞 자식부터 꺼내져요. */
function pushChildVNodes(stack: ToDOMTask[], vnode: VNode, parent: Node): void {
  if (vnode.kind !== 'element') return;
  for (let i = vnode.children.length - 1; i >= 0; i--) {
    stack.push({ vnode: vnode.children[i], parent });
  }
}
