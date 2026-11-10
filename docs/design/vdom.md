# Virtual DOM 변환 설계

- 상태: 작성 중
- 작성자: 임동호, 오동환
- 관련 이슈: #12

## 개요

Virtual DOM 변환은 영역 컨테이너 아래의 DOM 트리를 Virtual DOM 트리로 바꾸고, Virtual DOM 노드를 다시 DOM 노드로 바꿔요. 이 문서를 읽으면 모든 모듈이 주고받는 `VNode` 타입과 두 변환 함수의 동작 순서를 알고 구현할 수 있어요.

## 다루는 요구사항

| ID     | 요구사항 (원문)                                                                                                                              | 이 문서에서 다루는 곳 |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| FR-E01 | 시스템은 영역 컨테이너 아래의 DOM 트리를 태그, 속성, 자식(텍스트 노드 포함)을 가진 Virtual DOM 트리로 변환해야 한다.                         | 자료구조, 동작 방식   |
| FR-E02 | 시스템이 Virtual DOM 트리로 다시 만든 DOM은 원래 DOM과 같아야 한다.                                                                          | 동작 방식, 검증 방법  |
| FR-E05 | 시스템은 입력된 HTML 문자열이 아니라 브라우저가 파싱한 DOM 트리를 Virtual DOM 트리로 변환해야 한다.                                          | 인터페이스            |
| FR-E06 | 시스템은 DOM 트리를 Virtual DOM 트리로 변환할 때 공백과 줄바꿈만 있는 텍스트 노드도 텍스트 노드로 넣어야 한다.                               | 경계 케이스           |
| FR-E07 | 시스템은 DOM 트리를 Virtual DOM 트리로 변환할 때 주석 노드도 넣어야 한다.                                                                    | 경계 케이스           |
| FR-E08 | 시스템은 브라우저가 파싱한 모든 HTML 코드(빈 문자열 포함)를 Virtual DOM 트리로 변환할 수 있어야 하며, 별도의 유효성 검사를 하지 않아야 한다. | 경계 케이스           |

## 위치와 흐름

```text
영역 컨테이너의 DOM 트리 ──(toVNode)──▶ VNode[] ──▶ Diff, State History
VNode ──(toDOM)──▶ 새 DOM 노드 ──▶ Patch
```

- 입력을 주는 곳: 검증 페이지(로드 때 실제 영역, Patch 때 테스트 영역. 요구사항 4.1의 4단계, 4.2의 3단계), Patch(새 노드가 필요할 때)
- 출력을 받는 곳: [Diff](diff.md), [State History](history.md), [Patch](patch.md)

## 자료구조

노드 종류마다 타입을 나눠요. 텍스트 노드에 `children`이 들어가는 것 같은 잘못된 모양을 타입으로 막기 위해서예요.

```ts
type VNode = VElement | VText | VComment;

type VElement = {
  kind: 'element';
  tag: string;
  props: Record<string, string>;
  children: VNode[];
};

type VText = {
  kind: 'text';
  text: string;
};

type VComment = {
  kind: 'comment';
  text: string;
};
```

- `kind: 'element' | 'text' | 'comment'` — 노드 종류. DOM의 요소, 텍스트, 주석 노드에 하나씩 대응해요. 브라우저의 HTML 파서는 영역 안에 이 세 가지 외의 노드를 만들지 않아요. (예: `'element'`)
- `tag: string` — 요소 이름. DOM의 `localName`을 그대로 넣어요. HTML 요소는 소문자예요. (예: `'li'`)
- `props: Record<string, string>` — 속성 이름과 값. Phase 1에서는 HTML 속성 문자열만 담아요. 값이 없는 속성은 빈 문자열로 넣고, 속성이 없으면 `{}`예요. (예: `{ class: 'todo' }`, `<button disabled>` → `{ disabled: '' }`)
- `children: VNode[]` — 자식 노드를 DOM 순서대로 담아요. 공백·줄바꿈 텍스트와 주석도 포함해요. 자식이 없으면 `[]`예요. (예: `[{ kind: 'text', text: '장보기' }]`)
- `text: string` — 텍스트 노드나 주석 노드의 내용. DOM의 `nodeValue`를 공백까지 그대로 넣어요. 주석은 `<!--`와 `-->` 사이의 내용이에요. (예: `'\n  '`, `' 메모 '`)

`VNode`에는 실제 DOM 노드 참조를 두지 않아요. 참조를 두면 Patch가 그 DOM을 고칠 때 State History의 옛날 기록도 함께 바뀌어요. `key` 같은 Phase 2 필드는 이번 범위에 넣지 않아요. Phase 2에서 Diff를 key 기반 비교로 바꿀 때 더해요([ADR-002](../adr/ADR-002.md)).

## 인터페이스

```ts
function toVNode(container: Element): VNode[];
function toDOM(vnode: VNode): Node;
```

`toVNode`

- `container: Element` — 영역 컨테이너 요소. 브라우저가 파싱한 DOM을 받아요. 컨테이너 자신은 변환하지 않고 자식부터 변환해요. (예: 실제 영역 컨테이너)
- 반환값: 컨테이너의 자식 노드를 순서대로 변환한 배열. 자식이 없으면 `[]`예요. (예: 빈 문자열 → `[]`, `<p>A</p><p>B</p>` → `VElement` 두 개)
- 부수 효과: 없음. DOM을 읽기만 해요.

`toDOM`

- `vnode: VNode` — DOM으로 만들 노드. 자식까지 모두 만들어요. (예: `{ kind: 'element', tag: 'li', props: {}, children: [{ kind: 'text', text: 'B' }] }`)
- 반환값: 새로 만든 DOM 노드(`Element`, `Text`, `Comment` 중 하나). 문서에는 아직 붙지 않은 상태예요. (예: `<li>B</li>`)
- 부수 효과: 없음. 문서에 붙이는 건 [Patch](patch.md)가 해요.

## 동작 방식

두 함수 모두 [ADR-009](../adr/ADR-009.md)에 따라 재귀로 순회해요. 노드를 만들고, 자식마다 재귀로 만든 결과를 앞에서부터 차례로 붙여요. 자식은 `for` 반복문으로 돌아요. `map` 같은 콜백으로 돌면 재귀 한 단계마다 호출이 더 쌓여 버틸 수 있는 깊이가 줄어요.

### DOM → Virtual DOM (`toVNode`)

1. 컨테이너의 자식 노드를 앞에서부터 돌며, 노드마다 아래 2단계로 `VNode`를 만들어 결과 배열 끝에 붙여요.
2. 종류에 따라 `VNode`를 만들어요.
   - 요소: `tag`는 `localName`, `props`는 모든 속성의 이름과 값이에요. `children`은 이 요소의 자식 노드에 1~2단계를 재귀로 적용한 배열이에요.
   - 텍스트: `text`에 `nodeValue`를 넣어요.
   - 주석: `text`에 `nodeValue`를 넣어요.
3. 결과 배열을 돌려줘요. 형제 노드는 DOM 순서대로 들어가요.

### Virtual DOM → DOM (`toDOM`)

1. `kind`에 따라 DOM 노드를 만들어요.
   - `element`: `createElement(tag)`로 만들고, `props`의 모든 속성을 `setAttribute`로 붙여요.
   - `text`: `createTextNode(text)`
   - `comment`: `createComment(text)`
2. 요소면 `children`을 앞에서부터 돌며 각각 `toDOM`을 재귀로 불러, 만든 노드를 `appendChild`로 붙여요.
3. 만든 노드를 돌려줘요.

예시 (샘플 HTML 코드, FR-W23):

```text
입력: 실제 영역 컨테이너. 자식은 아래 HTML을 파싱한 DOM이에요.
<div id="app">
  <h1 class="title">할 일 목록</h1>
  <ul class="todo">
    <li>장보기</li>
    <li>운동하기</li>
  </ul>
  <button type="button">추가</button>
</div>
```

```ts
// 출력
[
  { kind: 'element', tag: 'div', props: { id: 'app' }, children: [
    { kind: 'text', text: '\n  ' },
    { kind: 'element', tag: 'h1', props: { class: 'title' }, children: [
      { kind: 'text', text: '할 일 목록' },
    ] },
    { kind: 'text', text: '\n  ' },
    { kind: 'element', tag: 'ul', props: { class: 'todo' }, children: [
      { kind: 'text', text: '\n    ' },
      { kind: 'element', tag: 'li', props: {}, children: [{ kind: 'text', text: '장보기' }] },
      { kind: 'text', text: '\n    ' },
      { kind: 'element', tag: 'li', props: {}, children: [{ kind: 'text', text: '운동하기' }] },
      { kind: 'text', text: '\n  ' },
    ] },
    { kind: 'text', text: '\n  ' },
    { kind: 'element', tag: 'button', props: { type: 'button' }, children: [
      { kind: 'text', text: '추가' },
    ] },
    { kind: 'text', text: '\n' },
  ] },
]
```

HTML 코드가 줄바꿈으로 끝나면 결과 배열 끝에 `{ kind: 'text', text: '\n' }`이 하나 더 붙어요.

## 설계 결정

| 결정                                                                      | 이유                                                                                                                         | 관련 ADR                    |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| 변환은 영역 컨테이너의 자식부터 시작하고 배열을 돌려준다                  | 텍스트만 있거나 루트가 여러 개인 입력도 그대로 처리해요. 컨테이너를 넣으면 두 영역 컨테이너의 속성 차이가 항상 Diff에 잡혀요 | [ADR-005](../adr/ADR-005.md) |
| 유효성 검사를 하지 않는다                                                 | 두 영역 모두 브라우저가 파싱하며 똑같이 보정해요                                                                             | [ADR-005](../adr/ADR-005.md) |
| Virtual DOM → DOM 변환은 Patch가 새 노드를 만들 때만 쓴다                | 렌더링 결과는 항상 파싱한 DOM으로 만들어요                                                                                   | [ADR-004](../adr/ADR-004.md) |
| 공백·줄바꿈·주석 노드를 모두 넣는다                                     | 노드 번호가 어긋나면 Patch가 엉뚱한 노드를 고쳐요                                                                            | [ADR-007](../adr/ADR-007.md) |
| 타입을 `VElement`, `VText`, `VComment`로 나누고 `kind`로 구분한다 | 잘못된 모양을 타입으로 막고, Diff가 노드 종류 차이를 교체로 바로 알아봐요                                                    | -                           |
| SVG·MathML처럼 HTML이 아닌 요소는 지원하지 않는다(`ns`를 담지 않는다) | 이번 과제의 샘플 HTML 코드에 그림 요소가 없어요. 지원하려면 `ns` 필드와 `createElementNS`가 더 필요해요 | -                           |
| `VNode`에 실제 DOM 참조를 두지 않는다                                   | Patch가 DOM을 고쳐도 State History의 옛날 기록이 바뀌지 않아요                                                               | -                           |
| 재귀로 순회하고, 자식은 `for` 반복문으로 돈다                             | 코드가 트리 모양과 닮아 이해하기 쉬워요. 파서가 깊이를 512단계로 제한해 콜 스택이 넘치지 않아요                              | [ADR-009](../adr/ADR-009.md) |

## 경계 케이스

| 경우                     | 입력 예시                              | 기대 동작                                                                | 관련 요구사항 |
| ------------------------ | -------------------------------------- | ------------------------------------------------------------------------ | ------------- |
| 브라우저가 태그를 보충함 | `<table><tr><td>A</td></tr></table>` | 트리에 `tbody`가 들어 있어요                                           | FR-E05        |
| 공백만 있는 텍스트 노드  | `<ul>`와 `<li>A</li>` 사이 줄바꿈  | `{ kind: 'text', text: '\n' }`으로 넣어요                              | FR-E06        |
| 주석 노드                | `<div><!-- 메모 --><p>A</p></div>`   | `div`의 자식이 `{ kind: 'comment', text: ' 메모 ' }`, `p` 순서예요 | FR-E07        |
| 빈 문자열                | (빈 문자열)                            | `[]`를 오류 없이 돌려줘요                                              | FR-E08        |
| 닫히지 않은 태그         | `<ul><li>A`                          | 브라우저가 보정한 결과를 그대로 변환해요                                 | FR-E08        |
| 텍스트만, 루트 여러 개   | `안녕`, `<p>A</p><p>B</p>`         | 배열에 루트를 순서대로 담아요                                            | FR-E08        |
| 값이 없는 속성           | `<button disabled>`                  | `props`가 `{ disabled: '' }`예요                                     | FR-E01        |
| SVG·MathML 요소          | `<svg><circle/></svg>`               | 지원하지 않아요. `toVNode`는 오류 없이 변환하지만, `toDOM`은 HTML 요소로 만들어 그려지지 않고 원래 DOM과 달라요 | FR-E02        |

## 검증 방법

- 단위 테스트
  - FR-E01: 샘플 HTML 코드를 변환해 위 예시 출력과 같은지 확인해요.
  - FR-E02: 각 루트를 `toDOM`으로 다시 만들어 원래 컨테이너의 자식과 `isEqualNode`로 비교해요. 공백·주석이 섞인 입력도 넣어요.
  - FR-E05: `<table>` 예시에서 `tbody`가 있는지 확인해요.
  - FR-E06, E07: 위 경계 케이스의 줄바꿈과 주석이 자식 순서대로 들어 있는지 확인해요.
  - FR-E08: 빈 문자열, 닫히지 않은 태그, 잘못된 중첩에서 오류가 없는지 확인해요.
- 검증 페이지: 이 모듈만 따로 확인하는 화면은 없어요. 로드 직후 첫 기록의 변환 결과(FR-W03)는 [검증 페이지 설계](page.md)에서 확인해요.

## 정하지 않은 것

- Virtual DOM → DOM으로 만든 `<script>`의 실행 여부: 요구사항 7절 스크립트 실행 정책과 함께 정해요.

## 관련 문서

- [요구사항 명세서](../requirements/phase1/phase1_requirement.md)
- [Diff 설계](diff.md), [Patch 설계](patch.md)
