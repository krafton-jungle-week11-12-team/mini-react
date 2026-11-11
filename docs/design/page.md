# 검증 페이지 설계

- 상태: 리뷰 중
- 작성자: 임동호
- 관련 이슈: #12

## 개요

검증 페이지는 실제 영역과 테스트 영역을 나란히 보여 주고, 로드·HTML 코드 수정·Patch·기록 이동 때 엔진 모듈을 순서대로 호출해요. 이 문서를 읽으면 이벤트마다 어떤 모듈을 어떤 순서로 호출하는지 알고 페이지를 구현할 수 있어요.

페이지는 엔진 모듈을 직접 import하지 않고 넘겨받아 써요. 그래서 Diff, Patch 같은 모듈을 다른 구현으로 바꿔 끼워도 페이지 코드는 고치지 않아도 돼요.

## 다루는 요구사항

| ID     | 요구사항 요약                                                                                       | 이 문서에서 다루는 곳                  |
| ------ | --------------------------------------------------------------------------------------------------- | -------------------------------------- |
| FR-W01 | 로드하면 화면을 실제 영역과 테스트 영역으로 나눠 보여 줘요                                          | 화면 구성, 검증 방법                   |
| FR-W02 | 로드하면 실제 영역에 샘플 HTML 코드를 보여 줘요                                                     | 로드                                   |
| FR-W22 | 로드하면 샘플 HTML 코드로 만든 DOM으로 실제 영역을 렌더링해요                                       | 로드                                   |
| FR-W23 | 샘플 HTML 코드는 정해진 구조예요                                                                    | 자료구조, 경계 케이스                  |
| FR-W03 | 로드하면 첫 기록을 위해 실제 영역의 DOM 트리를 Virtual DOM 트리로 변환해요                          | 로드                                   |
| FR-W04 | 로드하면 첫 기록의 Virtual DOM 트리를 DOM으로 변환해 테스트 영역을 렌더링해요 (ADR-013, 제안됨)     | 로드                                   |
| FR-W05 | 로드하면 테스트 영역에 실제 영역과 같은 HTML 코드를 보여 줘요                                       | 로드, 검증 방법                        |
| FR-W06 | 로드하면 두 영역의 렌더링 결과가 같아요                                                             | 검증 방법                              |
| FR-W07 | 로드하면 `{ html, vdom }`을 `history[0]`으로 저장해요                                               | 로드, 검증 방법                        |
| FR-W08 | 테스트 영역의 HTML 코드는 수정할 수 있어요                                                          | 화면 구성                              |
| FR-W24 | 실제 영역의 HTML 코드는 수정할 수 없어요                                                            | 화면 구성, 검증 방법                   |
| FR-W10 | 테스트 영역의 HTML 코드로 만든 트리가 현재 위치 기록의 `vdom`과 같은 동안 Patch 버튼을 비활성화해요 | HTML 코드 수정, 버튼 상태, 경계 케이스 |
| FR-W25 | 공백이나 줄바꿈만 바꿔도 바뀐 내용으로 판단해요                                                     | HTML 코드 수정, 경계 케이스            |
| FR-W26 | 주석만 추가해도 바뀐 내용으로 판단해요                                                              | HTML 코드 수정, 경계 케이스            |
| FR-W11 | Patch하면 새 Virtual DOM 트리를 DOM으로 변환해 테스트 영역을 렌더링해요 (ADR-013, 제안됨)           | Patch                                  |
| FR-W12 | Patch하면 수정한 HTML 코드를 화면 밖에서 파싱해 새 Virtual DOM 트리로 변환해요 (ADR-013, 제안됨)    | Patch                                  |
| FR-W13 | Patch하면 현재 위치 기록의 `vdom`과 새 트리를 Diff로 비교해요                                       | Patch, 경계 케이스                     |
| FR-W14 | Patch하면 바뀐 노드에 대해서만 DOM API를 호출해 실제 영역을 고쳐요                                  | Patch                                  |
| FR-W15 | Patch가 끝나면 두 영역의 렌더링 결과가 같아요                                                       | Patch, 검증 방법                       |
| FR-W17 | Patch하면 새 기록을 현재 위치 바로 뒤에 저장해요                                                    | Patch                                  |
| FR-W28 | 바뀐 내용 없이 Patch가 실행되면 실제 영역과 State History를 바꾸지 않아요                           | Patch, 경계 케이스, 검증 방법          |
| FR-E09 | 빈 문자열로 Patch하면 실제 영역의 모든 노드를 삭제해요                                              | 경계 케이스                            |
| FR-W19 | 뒤로가기하면 두 영역을 직전 기록의 상태로 바꿔요                                                    | 기록 이동, 검증 방법                   |
| FR-W20 | 앞으로가기하면 두 영역을 다음 기록의 상태로 바꿔요                                                  | 기록 이동, 검증 방법                   |
| FR-W21 | 현재 위치가 첫 기록이면 뒤로가기 버튼을 비활성화해요                                                | 버튼 상태, 검증 방법                   |
| FR-W29 | 현재 위치가 마지막 기록이면 앞으로가기 버튼을 비활성화해요                                          | 버튼 상태, 검증 방법                   |
| FR-X01 | (2차) 기록 목록과 현재 위치를 보여 줘요                                                             | 2차 추가 기능                          |
| FR-X03 | (2차) 현재 Virtual DOM 트리를 트리 형태로 보여 줘요                                                 | 2차 추가 기능                          |
| FR-X04 | (2차) 새 Virtual DOM 트리 기준으로 바뀐 노드와 변경 종류를 보여 줘요                                | 2차 추가 기능                          |

강조 표시와 요약 문구의 규칙(FR-W16, W27, W30)은 [변경 표시 설계](change-highlight.md), 기록 저장 규칙(FR-W18, W18-2)은 [State History 설계](history.md)에서 다뤄요.

## 위치와 흐름

[요구사항 4절 "동작 흐름"](../requirements/phase1/phase1_requirement.md#4-동작-흐름)의 세 흐름과 HTML 코드 수정을 이 문서가 엮어요.

```text
로드      : 샘플 HTML 코드 ─▶ 실제 영역 렌더링 ─▶ toVNode ─▶ createHistory(첫 기록) ─▶ toDOM으로 테스트 영역 렌더링
수정      : 입력창 ─▶ 별도 문서에서 파싱 ─▶ toVNode ─▶ diff ─▶ fromDiffResult ─▶ Patch 버튼 활성화·비활성화
Patch     : 별도 문서에서 파싱 ─▶ toVNode ─▶ toDOM으로 테스트 영역 렌더링 ─▶ diff ─▶ fromDiffResult ─▶ captureBefore ─▶ patch ─▶ showChanges ─▶ 두 영역 비교 ─▶ push(새 기록)
기록 이동 : back·forward ─▶ toDOM으로 두 영역 렌더링
```

- 입력을 주는 곳: 사용자(HTML 코드 수정, Patch·뒤로가기·앞으로가기 버튼)
- 출력을 받는 곳: 화면
- 페이지가 호출하는 모듈: [Virtual DOM 변환](vdom.md), [Diff](diff.md), [Patch](patch.md), [변경 표시](change-highlight.md), [State History](history.md). 모두 아래 `EngineModules`로 넘겨받아요.

## 자료구조

```ts
type EngineModules<R> = {
  toVNode(container: Element): VNode[];
  toDOM(vnode: VNode): Node;
  diff(oldRoots: VNode[], newRoots: VNode[]): R;
  patch(container: Element, result: R): void;
  fromDiffResult(result: R, oldRoots: VNode[]): ChangeRecord[];
  captureBefore(container: Element, records: ChangeRecord[], options?: HighlightOptions): TextBefore;
  showChanges(container: Element, records: ChangeRecord[], before: TextBefore, options?: HighlightOptions): ChangeSummary;
  createHistory<T>(first: T): StateHistory<T>;
};

type PageElements = {
  realCode: HTMLElement;
  realLines: HTMLElement;
  realRoot: HTMLElement;
  testCode: HTMLTextAreaElement;
  testLines: HTMLElement;
  testRoot: HTMLElement;
  patchButton: HTMLButtonElement;
  backButton: HTMLButtonElement;
  forwardButton: HTMLButtonElement;
  message: HTMLElement;
};

type Page = {
  onInput(): void;
  onPatch(): void;
  onBack(): void;
  onForward(): void;
  readonly history: StateHistory<HistoryEntry>;
};
```

`VNode`는 [Virtual DOM 변환 설계](vdom.md), `ChangeRecord`·`TextBefore`·`ChangeSummary`·`HighlightOptions`는 [변경 표시 설계](change-highlight.md), `StateHistory`·`HistoryEntry`는 [State History 설계](history.md)의 타입이에요.

- `EngineModules<R>` — 페이지가 호출하는 엔진 함수 묶음. 이 모양만 맞으면 어떤 구현이든 넣을 수 있어요.
  - `R` — Diff 결과의 타입. 페이지는 `R`의 내용을 읽지 않고 `patch`와 `fromDiffResult`에 그대로 넘겨요. 지금 Diff에서는 `(Patch | null)[]`예요.
  - 각 함수의 뜻과 규칙은 위 각 모듈 문서를 따라요. `toDOM`은 두 영역을 그릴 때 써요(ADR-013).
- `PageElements` — 화면의 요소 노드. `phase1.html`에 미리 있어요.
  - `realCode: HTMLElement` — 실제 영역의 HTML 코드를 보여 주는 요소 노드. HTML 코드는 `textContent`로만 넣어요. (예: `<pre id="real-code">`)
  - `realLines: HTMLElement` — `realCode` 왼쪽의 줄 번호 칸. 줄 번호만 `textContent`로 넣어요. (예: `<pre id="real-lines" aria-hidden="true">`)
  - `realRoot: HTMLElement` — 실제 영역 컨테이너. Patch가 고치는 곳이에요. (예: `<div id="real-root">`)
  - `testCode: HTMLTextAreaElement` — 테스트 영역의 HTML 코드 입력창. (예: `<textarea id="test-code">`)
  - `testLines: HTMLElement` — `testCode` 왼쪽의 줄 번호 칸. (예: `<pre id="test-lines" aria-hidden="true">`)
  - `testRoot: HTMLElement` — 테스트 영역 컨테이너. 항상 Virtual DOM 트리를 `toDOM`으로 변환해 렌더링해요(ADR-013). (예: `<div id="test-root">`)
  - `patchButton: HTMLButtonElement` — Patch 버튼. (예: `<button id="patch">`)
  - `backButton: HTMLButtonElement` — 뒤로가기 버튼. (예: `<button id="back">`)
  - `forwardButton: HTMLButtonElement` — 앞으로가기 버튼. (예: `<button id="forward">`)
  - `message: HTMLElement` — 요약 문구와 오류 문구를 보여 주는 요소 노드. (예: `<p id="message">`)
- `Page` — `createPage`가 돌려주는 값.
  - `onInput(): void` — 입력창의 `input` 이벤트 핸들러. Patch 버튼 상태를 갱신해요. (예: `page.onInput()`)
  - `onPatch(): void` — Patch 버튼의 `click` 이벤트 핸들러. (예: `page.onPatch()`)
  - `onBack(): void`, `onForward(): void` — 뒤로가기, 앞으로가기 버튼의 `click` 이벤트 핸들러. (예: `page.onBack()`)
  - `history: StateHistory<HistoryEntry>` — 페이지가 만든 State History. `readonly`라 다른 객체로 바꿀 수 없고, 기록은 핸들러가 바꿔요. 단위 테스트에서 기록 개수와 현재 위치를 확인할 때 써요. (예: `page.history.length`)

샘플 HTML 코드는 [요구사항 FR-W23](../requirements/phase1/phase1_requirement.md#페이지-로드)의 문자열을 그대로 `SAMPLE_HTML` 상수로 둬요. 끝에 줄바꿈을 붙이지 않아요.

## 인터페이스

```ts
function createPage<R>(
  elements: PageElements,
  sample: string,
  engine: EngineModules<R>,
  options?: HighlightOptions,
): Page;
```

- `elements: PageElements` — 화면의 요소 노드. (예: `{ realCode: <pre id="real-code">, ... }`)
- `sample: string` — 로드 때 실제 영역에 넣고 두 코드 칸에 보여 줄 HTML 코드. (예: `SAMPLE_HTML`)
- `engine: EngineModules<R>` — 엔진 함수 묶음. 실제 페이지에서는 `src/phase1/page/main.ts`가 각 모듈을 import해 묶어 넘겨요. 단위 테스트에서는 가짜 함수를 넣을 수 있어요. (예: `{ toVNode, toDOM, diff, patch, fromDiffResult, captureBefore, showChanges, createHistory }`)
- `options: HighlightOptions` — 변경 표시에 그대로 넘기는 옵션. 강조 표시 색은 여기서 정해요. jsdom 단위 테스트에서는 `readText`를 넣어요. (예: `{ readText: el => el.textContent ?? '' }`)
- 반환값: 이벤트 핸들러와 State History. 단위 테스트에서 핸들러를 직접 호출해요(FR-W28).
- 부수 효과: 로드 단계를 바로 실행해요. 버튼과 입력창에 핸들러를 연결해요.

### 모듈을 묶는 곳 (`src/phase1/page/main.ts`)

엔진 모듈을 import하는 곳은 `src/phase1/page/main.ts` 하나예요. 모듈을 다른 구현으로 바꿀 때는 여기만 고쳐요.

```ts
import { toVNode, toDOM } from './vdom';
import { diff } from './diff';
import { patch } from './patch';
import { fromDiffResult, captureBefore, showChanges } from './change-highlight';
import { createHistory } from './history';
import { createPage, SAMPLE_HTML } from './page';

createPage(getElements(document), SAMPLE_HTML, {
  toVNode, toDOM, diff, patch, fromDiffResult, captureBefore, showChanges, createHistory,
});
```

| 바꾸는 모듈               | 고칠 곳                                              |
| ------------------------- | ---------------------------------------------------- |
| Diff (결과 형식은 그대로) | `src/phase1/page/main.ts`의 import                               |
| Diff (결과 형식도 바뀜)   | `src/phase1/page/main.ts`의 import, 변경 표시의 `fromDiffResult` |
| Patch                     | `src/phase1/page/main.ts`의 import                               |
| State History             | `src/phase1/page/main.ts`의 import                               |
| 강조 표시 방법            | `createPage`의 `options.highlight`                   |

## 동작 방식

### 화면 구성

- 실제 영역의 HTML 코드는 `<pre>`로 보여 줘요. 입력창이 아니라서 수정할 수 없어요(FR-W24). 현재 위치 기록의 `html`을 보여 줘요.
- 테스트 영역의 HTML 코드는 `<textarea>`로 수정해요(FR-W08).
- 두 영역은 너비가 같고 나란히 놓여요(FR-W01). 요구사항 2.2는 이 수준만 요구해요. 배치, 색, 글자 같은 생김새는 [화면 스타일 설계](style.md)에서 다뤄요.
- `phase1.html`은 `<!DOCTYPE html>`로 시작해요. 그래야 버튼 판단용 문서와 화면의 문서가 같은 모드(no-quirks)로 파싱해요.
- 두 영역 컨테이너(`realRoot`, `testRoot`)에는 **똑같은** CSS만 걸어요. 한쪽에만 거는 CSS는 두지 않아요. 두 영역의 렌더링 결과가 같아 보여야 비교가 돼요(FR-W06, W15). 값은 [화면 스타일 설계](style.md#렌더링-결과-박스)를 따라요.

### 로드

1. `realCode.textContent`와 `testCode.value`에 샘플 HTML 코드를 넣어요(FR-W02, W05).
2. `realRoot.innerHTML`에 샘플 HTML 코드를 넣어 실제 영역을 렌더링해요(FR-W22). 과제에서 샘플 HTML 코드는 실제 영역에 주어진 입력이에요.
3. `engine.toVNode(realRoot)`로 Virtual DOM 트리를 만들어요(FR-W03).
4. `engine.createHistory({ html: 샘플 HTML 코드, vdom })`로 첫 기록을 저장해요(FR-W07).
5. 아래 "Virtual DOM 트리로 렌더링"대로 `vdom`을 `testRoot`에 그려요(FR-W04). 확인에 실패하면 `message`에 오류 문구를 보여 줘요.
6. 버튼 상태를 갱신해요. 세 버튼이 모두 비활성화돼요.

### Virtual DOM 트리로 렌더링

두 영역을 그리는 방법은 하나예요(ADR-013). 로드의 실제 영역만 예외로 샘플 HTML 코드를 넣어요.

1. 트리의 루트마다 `engine.toDOM`을 불러 DOM 노드를 만들고, `container.replaceChildren(...노드)`로 컨테이너의 자식을 모두 바꿔요.
2. `engine.toVNode(container)`로 그린 DOM을 다시 읽고, 원래 트리와 `engine.diff`로 비교해요.
3. `engine.fromDiffResult` 결과 길이가 0이 아니면 확인에 실패해요. `toDOM`이 트리를 그대로 옮기지 못한 거예요. 오류 문구는 "Virtual DOM 트리를 DOM으로 그린 결과가 원래 트리와 달라요"예요.

### HTML 코드 수정

입력창의 `input` 이벤트마다 아래를 해요.

1. 버튼 판단용 컨테이너를 만들어요. `document.implementation.createHTMLDocument('')`로 만든 별도 문서에서 `div`를 만들고, `innerHTML`에 입력창의 값을 넣어요.
2. `engine.toVNode`로 변환하고 [입력 걸러내기](sanitize.md)의 `sanitize`로 허용 목록 밖의 요소 노드와 속성을 빼요(ADR-014). 거른 트리를 현재 위치 기록의 `vdom`과 `engine.diff`로 비교해요.
3. `engine.fromDiffResult(result, 현재 위치 기록의 vdom)`의 길이가 0이면 Patch 버튼을 비활성화하고, 아니면 활성화해요(FR-W10). 공백·주석 변경도 Diff에 나오므로 버튼이 활성화돼요(FR-W25, W26).
4. `sanitize`가 뺀 것이 있으면 `message`에 "허용하지 않는 요소·속성은 빼고 반영해요: `<script>`, onclick" 문구를 보여 줘요. 뺀 것이 없어지면 마지막으로 보여 준 요약·오류 문구로 되돌려요.

테스트 영역은 이때 다시 렌더링하지 않아요. Patch 때만 렌더링해요(FR-W11). 1~2단계의 파싱과 거르기는 Patch 때도 그대로 써요.

### Patch

`old`는 현재 위치 기록의 `vdom`이에요.

1. `html = testCode.value`로 HTML 코드를 읽어요.
2. "HTML 코드 수정" 1~2단계처럼 별도 문서의 `div`에서 `html`을 파싱하고 `toVNode`, `sanitize`를 거쳐 새 트리 `newVdom`과 뺀 이름 `removed`를 만들어요(FR-W12, ADR-014). 파싱한 DOM은 화면에 붙이지 않아요.
3. "Virtual DOM 트리로 렌더링"대로 `newVdom`을 `testRoot`에 그려요(FR-W11). 확인에 실패하면 아래 "오류 처리"로 가요.
4. `result = engine.diff(old, newVdom)`로 비교해요(FR-W13).
5. `records = engine.fromDiffResult(result, old)`로 변경 목록을 만들어요. 길이가 0이면 여기서 끝내요. 실제 영역, State History, 요약 문구를 바꾸지 않아요(FR-W28).
6. `before = engine.captureBefore(realRoot, records, options)`로 Patch 전 정보를 읽어요.
7. `engine.patch(realRoot, result)`로 실제 영역을 고쳐요(FR-W14).
8. `summary = engine.showChanges(realRoot, records, before, options)`로 강조 표시하고, `summary.message`를 `message`에 보여 줘요(FR-W16, W30). `removed`가 있으면 뒤에 " · " 와 "HTML 코드 수정" 4단계의 문구를 붙여요.
9. `actual = engine.toVNode(realRoot)`로 실제 영역을 변환하고, `engine.fromDiffResult(engine.diff(actual, newVdom), actual)`의 길이가 0인지 확인해요(FR-W15). 0이 아니면 아래 "오류 처리"로 가요.
10. `history.push({ html, vdom: newVdom })`로 새 기록을 저장해요(FR-W17). `html`은 거르기 전 입력 원문이고, `vdom`은 거른 트리예요.
11. `realCode.textContent = html`로 실제 영역의 HTML 코드를 바꾸고, 버튼 상태를 갱신해요.

강조 표시는 다음 Patch까지 남아 있어요. 그래서 5단계 뒤(변경이 있을 때만) 지난 강조 표시를 지우고 6단계로 가요. 기록 이동과 오류 처리 때도 지워요. 강조 표시는 `animate()`로만 그리므로 실제 영역의 `getAnimations({ subtree: true })`를 모두 취소하면 지워져요. 속성은 바꾸지 않아요(FR-W27).

#### 오류 처리

3단계 확인에 실패하거나, 6~8단계에서 오류가 나거나, 9단계 확인에 실패하면 아래처럼 처리해요.

1. 현재 위치 기록의 `vdom`을 "Virtual DOM 트리로 렌더링"대로 `testRoot`, `realRoot`에 그려 두 영역의 렌더링 결과를 Patch 전 상태로 되돌려요. 입력창(`testCode.value`)은 사용자가 고친 내용 그대로 둬요. 그래서 고친 내용을 다시 Patch할 수 있어요.
2. `message`에 오류 문구를 보여 줘요. 3단계 실패면 "Virtual DOM 트리를 DOM으로 그린 결과가 원래 트리와 달라요", 6~8단계 오류면 "Patch 중 오류가 났어요: [오류 메시지]", 9단계 실패면 "Patch 후 두 영역이 달라요"예요.
3. State History에 저장하지 않아요. 버튼 상태를 갱신해요.

### 기록 이동 (뒤로가기, 앞으로가기)

`from`은 이동 전 위치 기록이에요. `back()`·`forward()`가 위치를 옮기기 전에 읽어 둬요.

1. `history.back()` 또는 `history.forward()`를 호출해요. `null`이면 아무것도 하지 않아요.
2. 지난 강조 표시를 지우고, `records = engine.fromDiffResult(engine.diff(from.vdom, 이동한 기록.vdom), from.vdom)`로 두 기록을 비교해요. 실제 영역이 아직 이동 전 기록과 같은 구조라 이때 `before = engine.captureBefore(realRoot, records, options)`도 읽어요.
3. 이동한 기록의 `html`을 `testCode.value`, `realCode.textContent`에 넣어요(FR-W19, W20).
4. "Virtual DOM 트리로 렌더링"대로 이동한 기록의 `vdom`을 `testRoot`, `realRoot`에 그려요. 확인에 실패하면 요약 문구 자리에 "기록 (이동 전 위치 + 1) → (이동한 위치 + 1): " 뒤에 오류 문구를 붙여 보여 주고, 5단계를 건너뛰어요.
5. `records`가 있으면 `engine.showChanges(realRoot, records, before, options)`로 강조 표시하고 Diff 결과 패널에 보여 줘요. 요약 문구는 "기록 (이동 전 위치 + 1) → (이동한 위치 + 1): 변경 N개 …", 바뀐 내용이 없으면 "…: 바뀐 내용 없음"이에요.
6. 버튼 상태를 갱신해요.

2단계나 5단계에서 오류가 나도 이동은 그대로 해요. 강조 표시와 Diff 결과만 보여 주지 않아요.

실제 영역은 Patch를 거치지 않고 기록의 상태 전체로 바꿔요([요구사항 4.3](../requirements/phase1/phase1_requirement.md#43-뒤로가기-앞으로가기), [ADR-010](../adr/ADR-010.md), [ADR-013](../adr/ADR-013.md)(제안됨)). 이동한 기록의 `vdom`에서 그리고 4단계에서 확인하므로, 실제 영역의 DOM은 이동한 기록의 `vdom`과 같은 구조가 돼요. 그래서 다음 Patch도 맞게 동작해요.

2·5단계의 비교는 화면에 보여 주기만 해요. 실제 영역을 고치는 데 쓰지 않아요. 뒤로 가면 방향이 거꾸로라, Patch 때 추가된 노드는 `remove`로 보여요.

### 버튼 상태

| 버튼       | 비활성화 조건                                                                   | 관련 요구사항 |
| ---------- | ------------------------------------------------------------------------------- | ------------- |
| Patch      | 입력창 값으로 만든 트리를 현재 위치 기록의 `vdom`과 비교한 변경 목록의 길이가 0 | FR-W10        |
| 뒤로가기   | `history.canBack()`이 `false`                                                   | FR-W21        |
| 앞으로가기 | `history.canForward()`가 `false`                                                | FR-W29        |

Patch 직후와 기록 이동 직후에는 입력창 값이 현재 위치 기록의 `html`과 같아 Patch 버튼이 비활성화돼요.

## 설계 결정

| 결정                                                                                                                                                             | 이유                                                                                                                                                                                                                                                       | 관련 ADR                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 엔진 모듈은 `createPage`에 함수 묶음(`EngineModules`)으로 넘기고, import는 `src/phase1/page/main.ts` 한 곳에서만 한다                                                        | 모듈을 다른 구현으로 바꿔도 페이지 코드는 그대로예요. 단위 테스트에서 가짜 모듈을 넣을 수 있어요                                                                                                                                                           | -                                     |
| 페이지는 Diff 결과의 내용을 읽지 않는다. 바뀐 내용이 있는지는 변경 표시의 `fromDiffResult` 결과 길이로 판단한다                                                  | Diff 결과 형식이 바뀌어도 페이지는 고치지 않아요. 형식을 아는 곳은 `fromDiffResult` 하나예요                                                                                                                                                               | -                                     |
| 두 영역은 로드(실제 영역 제외), Patch, 기록 이동 모두 Virtual DOM 트리를 `toDOM`으로 변환해 렌더링한다. HTML 코드는 트리를 만들 때만 파싱한다 | 과제 문서가 Virtual DOM 트리로 렌더링하라고 해요. Phase 2 렌더링과 같은 경로예요. 비교 기준은 파서로 만든 트리라 엔진을 거치지 않아요 | [ADR-013](../adr/ADR-013.md) (제안됨). [ADR-004](../adr/ADR-004.md)를 대체 |
| `toDOM`으로 그린 뒤 다시 `toVNode`로 읽어 원래 트리와 같은지 확인한다 | 두 영역을 같은 `toDOM`으로 그려 변환 버그가 양쪽에 똑같이 생겨도, 이 확인으로 화면에서 바로 드러나요 | [ADR-013](../adr/ADR-013.md) (제안됨) |
| HTML 코드의 유효성 검사를 하지 않는다 | 브라우저가 파싱하며 보정하고, 두 영역은 보정된 트리에서 그려요 | [ADR-005](../adr/ADR-005.md) |
| Patch 버튼은 공백·주석을 포함해 Diff에 변경이 있으면 활성화한다                                                                                                  | 버튼 상태가 Diff 결과와 항상 같아요                                                                                                                                                                                                                        | [ADR-007](../adr/ADR-007.md)          |
| Patch 버튼 판단은 입력창의 `input` 이벤트마다 한다                                                                                                               | 샘플 크기에서는 변환과 Diff가 빨라 지연이 필요 없어요                                                                                                                                                                                                      | -                                     |
| 버튼 판단용 파싱과 Patch의 파싱은 `createHTMLDocument`로 만든 별도 문서의 `div`에서 한다 | 화면의 문서에서 파싱하면 문서에 붙이지 않은 `div`에서도 이벤트 속성(`onerror` 등)이 입력 중에 실행돼요. `<template>`은 최상위 `<tr>`을 남겨 `div`와 결과가 달라요. 버튼 판단과 Patch가 같은 문서에서 파싱하므로 결과가 항상 같아요 | - |
| 변경 목록이 비면 Patch, 변경 표시, State History 저장을 하지 않고 끝낸다                                                                                         | 바뀐 내용 없이 Patch가 실행돼도 실제 영역과 State History가 바뀌지 않아요(FR-W28)                                                                                                                                                                          | -                                     |
| Patch 후 두 영역이 같은지 페이지에서 확인한다. 테스트 영역을 그리다 확인에 실패하거나, Patch 중 오류가 나거나, 두 영역 확인에 실패하면 두 영역을 현재 위치 기록의 `vdom`으로 다시 렌더링하고 기록을 저장하지 않는다 | 요구사항 4.2의 6단계예요. 엔진 버그를 화면에서 바로 알 수 있고, 어긋난 상태가 기록으로 남지 않아요(요구사항 6절) | - |
| 기록 이동 때도 이동 전 기록과 이동한 기록의 `vdom`을 비교해 강조 표시와 Diff 결과를 보여 준다. 비교 결과로 실제 영역을 고치지는 않는다 | 이동해도 무엇이 바뀌었는지 볼 수 있어요. 다시 그리기 전후의 실제 영역이 두 기록과 같은 구조라 변경 표시를 Patch 때와 똑같이 쓸 수 있어요 | [ADR-010](../adr/ADR-010.md) |
| 기록 이동 때 실제 영역은 기록의 `vdom`을 `toDOM`으로 다시 그려 바꾼다 | 요구사항 4.3이 "기록의 상태 전체로 바꾼다"고 정했어요. 이동한 기록의 `vdom`과 같은 구조가 돼요 | [ADR-010](../adr/ADR-010.md), [ADR-013](../adr/ADR-013.md) (제안됨) |
| HTML 코드 입력은 기본 입력창(textarea) 수준으로 한다                                                                                                             | 에디터 구현은 범위에서 제외했어요(요구사항 2.2)                                                                                                                                                                                                            | -                                     |
| 실제 영역의 HTML 코드 칸에는 바뀐 줄을 표시하지 않는다                                                                                                           | 엔진은 바뀐 노드만 알고 바뀐 줄은 몰라요. 줄 단위 비교를 따로 만들지 않고, 강조 표시와 Diff 결과 패널로 바뀐 부분을 보여 줘요                                                                                                                              | -                                     |
| 지난 강조 표시는 실제 영역의 `getAnimations({ subtree: true })`를 모두 취소해 지운다. 다음 Patch(변경이 있을 때), 기록 이동, 오류 처리 때 지운다                 | 강조 표시가 다음 Patch까지 남아요([화면 스타일 설계](style.md#강조-표시-모양)). 애니메이션만 취소하므로 속성이 바뀌지 않고(FR-W27), 강조한 요소 노드를 따로 기억하지 않아도 돼요. 바뀐 내용 없는 Patch는 아무것도 바꾸지 않아야 해서 지우지 않아요(FR-W28) | -                                     |
| 줄 번호는 코드 칸 옆 줄 번호 칸에 따로 넣는다                                                                                                                    | 코드 칸에는 HTML 코드만 남아 `textContent`와 `value`가 기록의 `html`과 그대로 같아요. 줄 번호가 복사나 비교에 섞이지 않아요                                                                                                                                | -                                     |
| 입력한 HTML 코드로 만든 트리는 레이아웃용 허용 목록으로 걸러, 목록 밖의 요소 노드와 속성을 빼고 반영한다. 뺀 것은 문구로 알린다 | 스크립트, 페이지 이동, 외부 요청, DOM clobbering이 화면에 닿지 않아요. 허용 목록은 [입력 걸러내기 설계](sanitize.md)에 있어요 | [ADR-014](../adr/ADR-014.md) (제안됨) |
| 사용자가 실제 영역을 조작해 프로퍼티만 바뀐 차이(input의 `value` 등)는 맞추지 않는다                                                                             | Virtual DOM 트리는 속성만 담아서 이런 차이는 Diff에도, 9단계 확인에도 잡히지 않아요. 속성이나 노드가 바뀐 조작은 9단계 확인에서 잡혀 되돌려져요. 입력을 막는 기능은 Phase 1 범위 밖이에요                                                                  | -                                     |

## 경계 케이스

| 경우                             | 입력 예시                               | 기대 동작                                                                                                                                                                                                                                                                                                            | 관련 요구사항    |
| -------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 로드 직후                        | 샘플 HTML 코드                          | 두 영역의 HTML 코드와 렌더링 결과가 같아요. 세 버튼이 모두 비활성화돼요                                                                                                                                                                                                                                              | FR-W05, W06, W23 |
| 수정 후 원래대로 되돌림          | 샘플 → 수정 → 샘플                      | Patch 버튼이 다시 비활성화돼요                                                                                                                                                                                                                                                                                       | FR-W10           |
| 공백이나 줄바꿈만 바꿈           | 들여쓰기 변경                           | Patch 버튼이 활성화돼요                                                                                                                                                                                                                                                                                              | FR-W25           |
| 주석만 추가                      | `<!-- 메모 -->` 추가                    | Patch 버튼이 활성화돼요                                                                                                                                                                                                                                                                                              | FR-W26           |
| HTML 코드는 다르지만 DOM이 같음  | `</li>`를 `</LI>`로 바꿈                | 변경 목록이 비어 Patch 버튼이 비활성화돼요. 기록에는 저장되지 않아요                                                                                                                                                                                                                                                 | FR-W10           |
| 바뀐 내용 없이 Patch 핸들러 호출 | `onPatch()` 직접 호출                   | 실제 영역, State History, 요약 문구가 바뀌지 않아요                                                                                                                                                                                                                                                                  | FR-W28           |
| 빈 문자열로 Patch                | (빈 문자열)                             | 실제 영역의 노드가 모두 삭제돼요                                                                                                                                                                                                                                                                                     | FR-E09           |
| 뒤로 이동한 위치에서 Patch       | 기록 3개에서 두 번 뒤로 이동한 뒤 Patch | 그 위치의 `vdom`과 비교해요                                                                                                                                                                                                                                                                                          | FR-W13, W18      |
| 수정 중에 기록 이동              | 입력창을 고친 뒤 뒤로가기               | 입력창의 수정 내용이 이동한 기록의 `html`로 덮어써져요                                                                                                                                                                                                                                                               | FR-W19           |
| 두 영역의 `id`가 겹침            | 샘플의 `id="app"`                       | 문서에 `id="app"`이 두 개 생겨요. 엔진은 `id`로 노드를 찾지 않아 영향이 없어요                                                                                                                                                                                                                                       | FR-W23           |
| 이벤트 속성 입력                 | `<img src=x onerror=alert(1)>`          | `img`가 허용 목록에 없어 통째로 빠지고, 안내 문구에 `<img>`가 보여요. 이벤트 속성은 허용한 요소 노드에서도 빠져요(ADR-014) | FR-W31 |
| `<script>` 입력                  | `<script>alert(1)</script>`             | 통째로 빠져 두 영역 어디서도 실행되지 않아요. 다른 변경 없이 더하기만 하면 Patch 버튼이 비활성화돼요(ADR-014) | FR-W10, W31 |
| `<noscript>` 입력                | `<noscript><p>A</p></noscript>`         | 허용 목록에 없어 자식까지 빠져요(ADR-014) | FR-W31 |

## 검증 방법

- 단위 테스트 (jsdom, `createPage`에 요소 노드, 엔진 함수 묶음, `options.readText`를 넘김)
  - 실제 엔진 함수를 넣으면 통합 테스트, 가짜 함수를 넣으면 페이지 흐름만 확인하는 테스트가 돼요. Diff·Patch 구현이 끝나기 전에는 가짜 함수로 확인해요.
  - FR-W07, W21, W29: 로드 직후 `history.length`가 1이고 세 버튼이 비활성화됐는지 확인해요.
  - FR-W10, W25, W26: 입력창 값을 바꾸고 `onInput()`을 호출해 Patch 버튼 상태를 확인해요.
  - FR-W28: 수정 없이 `onPatch()`를 호출해 실제 영역의 모든 노드가 같은 객체(`===`)로 남고 `history.length`가 그대로인지 확인해요. 가짜 `patch`가 호출되지 않았는지도 확인해요.
  - FR-W15: Patch 경계 케이스마다 두 영역을 `toVNode`로 변환해 변경 목록이 비는지 확인해요.
  - 오류 처리: 오류를 던지는 가짜 `patch`를 넣고 `onPatch()`를 호출해, 두 영역이 현재 위치 기록의 `vdom`으로 돌아가고 `history.length`가 그대로인지 확인해요.
  - Virtual DOM 트리로 렌더링: 감시하는 `toDOM`을 넣어 로드, Patch, 기록 이동 때 불리는지 확인해요. 속성을 빼는 잘못된 `toDOM`을 넣으면 로드 때 오류 문구가 보이고, Patch 때 기록이 저장되지 않는지 확인해요.
  - FR-W19, W20: `onBack()`, `onForward()` 뒤 `testCode.value`가 `history.current().html` 원문과 같고, 두 영역을 변환한 트리가 `history.current().vdom`과 같은지 확인해요.
  - 기록 이동 비교: 이동 뒤 요약 문구가 "기록 2 → 1: 변경 N개" 형식이고, 가짜 `patch`가 호출되지 않는지 확인해요.
- 검증 페이지 (실제 브라우저)
  - FR-W01, W05, W06: 로드 직후 두 영역이 나란히 보이고, 두 영역의 HTML 코드 문자열과 렌더링 결과가 같은지 확인해요.
  - FR-W24: 실제 영역의 HTML 코드를 고칠 수 없는지 확인해요.

## 2차 추가 기능

이 절은 요구사항 5.3의 2차 추가 기능(FR-X01, X03, X04)의 동작이에요. 5.1, 5.2를 모두 만족한 뒤 구현해요. 이 절을 빼도 위 기본 흐름은 그대로 동작해요. 배치, 색, 글자 같은 생김새는 [화면 스타일 설계](style.md)에서 다뤄요.

### 더하는 요소 노드

2차 기능에서는 `PageElements`에 아래 칸을 더해요. `id`는 [화면 스타일 설계](style.md#인터페이스)를 따라요.

```ts
type PageElementsX = PageElements & {
  historyLabel: HTMLElement;
  vdomView: HTMLElement;
  diffView: HTMLElement;
  historyView: HTMLElement;
};
```

- `historyLabel: HTMLElement` — 머리글에서 현재 위치를 보여 주는 요소 노드. "기록 (현재 위치 + 1) / (기록 개수)"를 넣어요. (예: `<span id="history-label">기록 2 / 3</span>`)
- `vdomView: HTMLElement` — 현재 위치 기록의 Virtual DOM 트리를 보여 주는 패널(FR-X03). (예: `<pre id="vdom-view">`)
- `diffView: HTMLElement` — 마지막 Patch의 변경 목록을 보여 주는 패널(FR-X04). (예: `<ol id="diff-view">`)
- `historyView: HTMLElement` — 기록 목록과 현재 위치를 보여 주는 패널(FR-X01). (예: `<ol id="history-view">`)

### 패널 갱신

| 패널             | 언제 갱신하나                     | 보여 주는 것                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `historyLabel`   | 로드, Patch 저장 뒤, 기록 이동 뒤 | "기록 (`history.index` + 1) / (`history.length`)"                                                                                                                                                                                                                                                                                                                                                                                  |
| Virtual DOM 트리 | 로드, Patch 저장 뒤, 기록 이동 뒤 | `history.current().vdom`을 한 줄에 노드 하나씩 나무 모양(`├─`, `└─`)으로 그려요. 요소 노드는 태그와 속성(예: `h1 class="title"`), 글자 하나만 가진 요소 노드는 한 줄로 줄여요(예: `li ─ "장보기"`). 텍스트 노드는 `"내용"`이고 줄바꿈은 `\n`, 공백만 있는 텍스트는 공백도 `·`로 보여요(예: `"\n··"`). 주석 노드는 `<!--내용-->`이에요                                                                                              |
| Diff 결과        | Patch 저장 뒤, 기록 이동 뒤       | `summary.items`를 한 줄씩. 형식은 `kind 경로 detail`이에요(예: `text [0,1,0] '오늘 할 일'`). 경로는 `newPath`, 없으면 `oldPath`예요. `text`와 텍스트 노드의 `create`·`replace`는 내용을 작은따옴표로 감싸고, `remove`는 "삭제"라고 써요. `visible`이 `false`인 줄은 점선 칩과 흐린 글자로 구분하고 끝에 "· 안 보여요"를 붙여요. 기록 이동 뒤에는 이동 전 기록과 이동한 기록의 비교 결과를 보여 줘요. Patch 오류 처리 뒤에는 비워요 |
| 기록 목록        | 로드, Patch 저장 뒤, 기록 이동 뒤 | 기록마다 제목과 설명 두 줄. 제목은 "기록 N", 현재 위치 기록은 "기록 N (지금 보는 기록)"이에요. 설명은 첫 기록이 "샘플 HTML 코드로 로드", 나머지는 "Patch, (요약 문구)"예요. State History는 기록 목록 전체를 꺼내 주지 않아서 페이지가 설명 목록을 따로 들고 있어요. `push`로 뒤 기록이 지워지면 설명도 같이 지워요                                                                                                                |

- 패널 갱신은 기본 흐름의 각 단계 끝(로드 5단계, Patch 11단계, 기록 이동 6단계)에서 호출해요. Patch 오류 처리 뒤에는 Diff 결과 패널을 비워요.
- 패널은 화면에 보여 주기만 해요. 엔진 모듈의 결과를 바꾸지 않아요.
- 패널은 Diff 결과(`R`)를 직접 읽지 않아요. 변경 표시의 `ChangeSummary`만 써요.
- 기록 목록을 눌러 그 기록으로 이동하는 기능(FR-X02)과 샘플 선택(FR-X05)은 넣지 않아요.

### 스크롤 맞추기

- 두 영역 컨테이너(`realRoot`, `testRoot`)와 두 HTML 코드 칸(`realCode`, `testCode`)은 스크롤을 함께 움직여요. 규칙은 [화면 스타일 설계](style.md#스크롤-맞추기)를 따라요.
- 줄 번호 칸(`realLines`, `testLines`)은 옆 코드 칸의 `scrollTop`을 그대로 따라가요.
- 스크롤 이벤트는 `createPage`가 연결해요. `src/phase1/page/main.ts`는 모듈을 묶어 넘기기만 해요.

### HTML 코드 칸

- 실제 영역의 HTML 코드 칸(`realCode`)에는 바뀐 줄을 표시하지 않아요. HTML 코드는 `textContent`로만 넣어요. 바뀐 부분은 렌더링 결과의 강조 표시와 Diff 결과 패널로 보여 줘요.
- 줄 번호는 코드 칸 옆 줄 번호 칸에 따로 넣어요. 코드 칸의 줄 수(`\n` 개수 + 1)만큼 `1\n2\n…`을 `textContent`로 넣어요. (예: 9줄이면 `'1\n2\n3\n4\n5\n6\n7\n8\n9'`)
- `realCode.textContent`나 `testCode.value`를 바꾸는 모든 곳(로드 1단계, Patch 11단계, 기록 이동 2단계, 입력창 `input` 이벤트)에서 그 칸의 줄 번호도 갱신해요.

## 정하지 않은 것

- 스크립트 실행 정책을 요구사항에 반영할지: [ADR-014](../adr/ADR-014.md)(제안됨)가 승인되면 요구사항 2.2의 "스크립트 실행 차단" 행과 [7절](../requirements/phase1/phase1_requirement.md#7-추후-논의) 항목을 지워요.

## 관련 문서

- [요구사항 명세서](../requirements/phase1/phase1_requirement.md)
- [ADR-004](../adr/ADR-004.md), [ADR-005](../adr/ADR-005.md), [ADR-007](../adr/ADR-007.md), [ADR-010](../adr/ADR-010.md), [ADR-013](../adr/ADR-013.md), [ADR-014](../adr/ADR-014.md)
- [입력 걸러내기 설계](sanitize.md), [Virtual DOM 변환 설계](vdom.md), [Diff 설계](diff.md), [Patch 설계](patch.md), [State History 설계](history.md), [변경 표시 설계](change-highlight.md), [화면 스타일 설계](style.md)
