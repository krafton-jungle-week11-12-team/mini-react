# 입력 걸러내기 설계

- 상태: 작성 중
- 작성자: [이름]
- 관련 이슈: #[번호]

## 개요

입력 걸러내기는 사용자가 입력한 HTML 코드로 만든 Virtual DOM 트리에서 허용 목록 밖의 요소 노드와 속성을 빼요. 이 문서를 읽으면 무엇이 허용되고 무엇이 왜 빠지는지 알고, `src/phase1/page/sanitize.ts`를 구현하거나 허용 목록을 고칠 수 있어요. 왜 허용 목록을 쓰는지는 [ADR-014](../adr/ADR-014.md)를 봐요.

## 다루는 요구사항

| ID     | 요구사항 요약                                                                           | 이 문서에서 다루는 곳          |
| ------ | --------------------------------------------------------------------------------------- | ------------------------------ |
| FR-W31 | (ADR-014 승인 시 추가) 허용 목록 밖의 요소 노드와 속성은 빼고 반영하고, 뺀 것의 이름을 보여 줘요 | 동작 방식, 경계 케이스, 검증 방법 |
| FR-W10 | 입력창의 HTML 코드로 만든 트리가 현재 위치 기록의 `vdom`과 같은 동안 Patch 버튼을 비활성화해요 | 경계 케이스                    |

## 위치와 흐름

```text
입력창의 HTML 코드 ─▶ 별도 문서에서 파싱 ─▶ toVNode ─▶ sanitize ─▶ diff(버튼 판단), toDOM(두 영역), State History
```

- 입력을 주는 곳: [검증 페이지](page.md)의 파싱. 입력창 `input` 이벤트와 Patch 버튼 때 불러요.
- 출력을 받는 곳: 검증 페이지. 거른 트리로 Patch 버튼을 판단하고, 두 영역을 그리고, 기록에 저장해요. 뺀 이름은 `message`에 보여 줘요.

## 자료구조

```ts
type SanitizeResult = {
  roots: VNode[];
  removed: string[];
};

const ALLOWED_TAGS: ReadonlySet<string>;
const ALLOWED_ATTRS: ReadonlySet<string>;
```

- `roots: VNode[]` — 허용 목록 밖의 요소 노드와 속성을 뺀 새 트리. 받은 트리와 다른 객체예요. (예: `<p onclick="a">A</p><script></script>` → `[{ kind: 'element', tag: 'p', props: {}, children: [{ kind: 'text', text: 'A' }] }]`)
- `removed: string[]` — 뺀 것의 이름. 요소 노드는 `<태그>`, 속성은 속성 이름으로 써요. 처음 나온 순서이고 겹치지 않아요. (예: `['onclick', '<script>']`)
- `ALLOWED_TAGS` — 허용하는 요소 노드의 `localName`. 아래 "허용 목록" 표의 요소 노드예요. (예: `'div'`)
- `ALLOWED_ATTRS` — 허용하는 속성 이름. 아래 "허용 목록" 표의 속성이에요. `aria-`, `data-`로 시작하는 속성은 이 목록과 상관없이 허용해요. (예: `'class'`)

### 허용 목록

| 묶음        | 요소 노드                                                                                                             |
| ----------- | --------------------------------------------------------------------------------------------------------------------- |
| 구획        | `div` `span` `p` `br` `hr` `section` `article` `header` `footer` `nav` `main` `aside` `address` `h1`~`h6` `blockquote` `figure` `figcaption` `details` `summary` |
| 목록        | `ul` `ol` `li` `dl` `dt` `dd`                                                                                          |
| 표          | `table` `caption` `colgroup` `col` `thead` `tbody` `tfoot` `tr` `th` `td`                                              |
| 글자        | `pre` `code` `kbd` `samp` `var` `strong` `em` `b` `i` `u` `s` `small` `mark` `sub` `sup` `abbr` `cite` `q` `del` `ins` `time` |
| 입력 요소   | `button` `label` `input` `textarea` `select` `option` `optgroup` `fieldset` `legend` `progress` `meter`                 |

| 묶음        | 속성                                                                                                                  |
| ----------- | --------------------------------------------------------------------------------------------------------------------- |
| 모든 요소   | `id` `class` `style` `title` `lang` `dir` `hidden` `role` `key` `aria-*` `data-*`                                     |
| 표, 목록    | `colspan` `rowspan` `span` `scope` `headers` `start` `reversed`                                                       |
| 입력 요소   | `type` `value` `placeholder` `checked` `disabled` `readonly` `selected` `multiple` `rows` `cols` `size` `min` `max` `step` `maxlength` `minlength` `label` `for` `low` `high` `optimum` |
| 그 밖       | `open` `datetime`                                                                                                     |

## 인터페이스

```ts
function sanitize(roots: VNode[]): SanitizeResult;
```

- `roots: VNode[]` — `toVNode`로 만든 트리. 요소 노드의 `tag`는 `localName`(소문자)이에요. (예: `toVNode(div)`)
- 반환값: 거른 트리와 뺀 이름. (예: `{ roots: [...], removed: ['<script>'] }`)
- 부수 효과: 없음. 받은 트리를 고치지 않아요.

## 동작 방식

루트 목록부터 앞에서 차례로 돌아요. 자식 목록도 같은 방법으로 재귀해 돌아요.

1. 텍스트 노드와 주석 노드는 그대로 새 목록에 넣어요.
2. 요소 노드의 `tag`가 `ALLOWED_TAGS`에 없으면 `<tag>`를 `removed`에 넣고, 자식까지 새 목록에 넣지 않아요.
3. 허용한 요소 노드는 `props`의 속성마다 확인해요.
   - `style`이면 값에 `url(`, `image(`, `image-set(`, 역슬래시가 없을 때만 남겨요. 대소문자와 괄호 앞 공백은 가리지 않아요.
   - `aria-`, `data-`로 시작하면 남겨요.
   - 나머지는 `ALLOWED_ATTRS`에 있을 때만 남겨요.
   - 남기지 않은 속성은 이름을 `removed`에 넣어요.
4. 자식 목록을 1~3단계로 걸러 새 요소 노드를 만들어요. `key`가 있으면 그대로 옮겨요.

예시:

```text
입력: <li key="a" onclick="x()">장보기</li><script>alert(1)</script>
출력: roots = <li key="a">장보기</li>
      removed = ['onclick', '<script>']
```

## 설계 결정

| 결정 | 이유 | 관련 ADR |
| ---- | ---- | -------- |
| 차단 목록이 아니라 허용 목록으로 거른다 | 목록에 없는 것은 모두 빠져, 빠뜨린 위험이 생기지 않아요 | [ADR-014](../adr/ADR-014.md) (제안됨) |
| DOM이 아니라 Virtual DOM 트리를 거른다 | 파싱한 DOM은 화면 밖 문서에 있어 화면에 닿지 않아요. 트리를 거르면 버튼 판단, 두 영역, 기록이 모두 같은 트리를 써요 | [ADR-013](../adr/ADR-013.md) (제안됨), [ADR-014](../adr/ADR-014.md) (제안됨) |
| 허용하지 않는 요소 노드는 자식까지 뺀다 | `<script>`, `<style>`의 내용이 텍스트로 화면에 나오지 않아요. `<form>` 안의 버튼만 남기는 것처럼 뜻이 바뀐 구조도 남지 않아요 | [ADR-014](../adr/ADR-014.md) (제안됨) |
| `name` 속성을 허용하지 않는다 | `name`은 `document`의 같은 이름 속성을 덮을 수 있어요(DOM clobbering). `toDOM`이 `document.createElement`를 쓰기 때문에 막아야 해요 | [ADR-014](../adr/ADR-014.md) (제안됨) |
| `style`은 허용하되 외부 요청을 보낼 수 있는 값이면 통째로 뺀다 | 레이아웃 실험에 필요해요. 값 일부만 고치면 남은 CSS가 입력과 달라져 헷갈려요. 역슬래시는 CSS 이스케이프로 `url`을 숨길 수 있어 막아요 | [ADR-014](../adr/ADR-014.md) (제안됨) |
| `position: fixed`는 거르지 않고 CSS `contain: paint`로 가둔다 | 값을 하나씩 막는 것보다 단순해요. `contain: paint`를 건 박스는 fixed 요소 노드의 기준이 되고 박스 밖을 그리지 않아요([화면 스타일 설계](style.md#렌더링-결과-박스)) | [ADR-014](../adr/ADR-014.md) (제안됨) |
| `key`를 허용한다 | 검증 페이지에서 key 비교를 확인할 수 있어야 해요 | [ADR-011](../adr/ADR-011.md) (제안됨) |
| 자식은 `for` 반복문으로 돈다 | 재귀 한 단계마다 쌓이는 호출을 줄여요 | [ADR-009](../adr/ADR-009.md) |

## 경계 케이스

| 경우 | 입력 예시 | 기대 동작 | 관련 요구사항 |
| ---- | --------- | --------- | ------------- |
| 스크립트 | `<script>alert(1)</script>` | 통째로 빠지고 `removed`는 `['<script>']`예요 | FR-W31 |
| 이벤트 속성 | `<button onclick="x()">추가</button>` | `button`은 남고 `onclick`만 빠져요 | FR-W31 |
| 페이지 이동 | `<form><button>보내기</button></form>`, `<a href="/">링크</a>` | `form`, `a`가 자식까지 빠져요 | FR-W31 |
| 페이지 전체에 영향 | `<style>`, `<link>`, `<base>`, `<meta>` | 모두 빠져요 | FR-W31 |
| DOM clobbering | `<img name="createElement">`, `<div name="x">` | `img`는 통째로, `div`는 `name`만 빠져요 | FR-W31 |
| 외부 요청을 보내는 style | `style="background:url(x.png)"`, `style="background:u\72 l(x)"` | `style`이 통째로 빠져요 | FR-W31 |
| 레이아웃 style | `style="position:fixed; inset:0"` | 남아요. 렌더링 결과 박스 밖을 덮지 않아요 | FR-W31 |
| 허용하지 않는 요소 노드 안의 허용한 요소 노드 | `<noscript><p>A</p></noscript>` | `p`도 함께 빠져요 | FR-W31 |
| 뺄 것만 더함 | 샘플 HTML 코드 + `<script></script>` | 거른 트리가 현재 위치 기록과 같아 Patch 버튼이 비활성화돼요. 안내 문구는 보여요 | FR-W10, W31 |
| 같은 이름이 여러 번 | `<p onclick>`, `<p onclick>` | `removed`에 `onclick`은 한 번만 있어요 | FR-W31 |
| 빈 트리 | `[]` | `{ roots: [], removed: [] }` | FR-E08 |

## 검증 방법

- 단위 테스트 (`src/phase1/tests/sanitize.test.ts`, jsdom): 화면 밖 문서에서 파싱한 트리를 넣어, 경계 케이스마다 `roots`와 `removed`를 확인해요. 받은 트리가 바뀌지 않았는지 `structuredClone` 복사본과 비교해요.
- 단위 테스트 (`src/phase1/tests/page.test.ts`): 입력 중 안내 문구, 뺄 것만 더했을 때 Patch 버튼 비활성화, Patch 뒤 두 영역에 `script`와 `[onclick]`이 없는지, 기록 이동 뒤 Patch 버튼 상태를 확인해요.
- 검증 페이지 (실제 브라우저): jsdom은 스크립트를 실행하지 않아 브라우저에서 확인해요. `<script>`, `onmouseover`, `<img onerror>`가 실행되지 않는지, `position: fixed` 요소 노드가 렌더링 결과 박스 안에 있는지, `<img name="createElement">`를 넣은 뒤에도 다음 Patch가 되는지 확인해요.

## 관련 문서

- [요구사항 명세서](../requirements/phase1/phase1_requirement.md)
- [ADR-014](../adr/ADR-014.md), [ADR-013](../adr/ADR-013.md)
- [검증 페이지 설계](page.md), [Virtual DOM 변환 설계](vdom.md), [화면 스타일 설계](style.md)
