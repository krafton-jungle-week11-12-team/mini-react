# 샘플 선택 설계

- 상태: 작성 중
- 작성자: 오동환
- 관련 이슈: #82

## 개요

샘플 선택은 검증 페이지 위쪽의 탭에서 Diff 종류별 샘플 HTML 코드를 골라, 두 영역과 State History를 그 샘플로 처음부터 다시 만들어요. 탭마다 "이렇게 고쳐 보세요" 안내를 붙여, 고르고 한 번 고친 뒤 Patch를 누르면 그 종류의 Diff 결과(특히 key 이동)를 바로 볼 수 있어요. 이 문서를 읽으면 샘플 목록의 모양, `loadSample`이 다시 만드는 상태, 탭을 그리는 방법을 알고 `src/phase1/page/samples.ts`와 `page.ts`의 `loadSample`을 구현할 수 있어요.

## 다루는 요구사항

| ID     | 요구사항 요약                                                                                   | 이 문서에서 다루는 곳         |
| ------ | ----------------------------------------------------------------------------------------------- | ----------------------------- |
| FR-X05 | (2차) Diff 종류별 샘플 HTML 코드를 선택하면 그 샘플로 두 영역과 첫 기록을 다시 만들어요            | 자료구조, 인터페이스, 동작 방식 |

## 위치와 흐름

```text
탭 클릭 → renderSampleTabs의 onSelect → page.loadSample(html, note)
  → 로드 단계(FR-W02~W07)를 그 샘플로 다시 실행 → 두 영역, 코드 칸, 새 State History, 패널
```

- 입력을 주는 곳: 사용자의 탭 클릭. 탭은 `src/phase1/page/main.ts`가 `renderSampleTabs`로 그려요.
- 출력을 받는 곳: [검증 페이지](page.md)의 `createPage`가 돌려준 `Page`(`loadSample`), [State History](history.md)의 `createHistory`(새 기록)

## 자료구조

```ts
// src/phase1/page/samples.ts
type Sample = {
  id: string;
  label: string;
  hint: string;
  html: string;
};

const SAMPLES: readonly Sample[];
```

- `id: string` — 탭을 가리키는 이름. kebab-case예요. (예: `'keyed-move'`)
- `label: string` — 탭에 쓰는 글자. (예: `'key 이동'`)
- `hint: string` — 탭 옆에 보여 줄 안내 한 줄. 무엇을 고치면 어떤 Diff가 나오는지 써요. (예: `'c 줄을 맨 위로 옮기고 Patch를 눌러 보세요'`)
- `html: string` — 샘플 HTML 코드. 끝에 줄바꿈을 붙이지 않아요. (예: `SAMPLE_HTML`)

`SAMPLES`는 아래 다섯 개이고, 첫 번째가 로드 때의 샘플이에요.

| id            | label                | 시작 HTML                                   | 안내대로 고치면 나오는 Diff        |
| ------------- | -------------------- | ------------------------------------------- | ---------------------------------- |
| `basic`       | 기본                 | `SAMPLE_HTML` (FR-W23)                      | 자유롭게                           |
| `text-props`  | 글자·속성            | `h1.title`, `p.note`가 있는 `div`           | `text`, `props`                    |
| `add-remove`  | 추가·삭제            | key 없는 `li` 세 개                         | 가운데 삭제 → 뒤 항목 `text`와 끝의 `remove` |
| `keyed-move`  | key 이동             | key가 있는 `li` 세 개, `li` 사이 공백 없음  | 순서 바꾸기 → `move`               |
| `index-move`  | key 없이 순서 바꾸기 | `keyed-move`와 같고 key만 없음              | 같은 수정 → `move` 없이 `text`만   |

`keyed-move`, `index-move`는 줄바꿈을 닫는 `>` 앞에 둬요. `li` 사이에 공백 텍스트 노드가 생기지 않아, 모든 형제가 key를 가져 key 비교가 동작해요. 한 줄에 `li` 하나라 줄을 통째로 옮기면 순서가 바뀌어요.

```html
<ul class="todo"
  ><li key="a">장보기</li
  ><li key="b">운동하기</li
  ><li key="c">안녕</li
></ul>
```

## 인터페이스

```ts
// src/phase1/page/page.ts (Page에 더함)
type Page = {
  // …기존 onInput, onPatch, onBack, onForward
  loadSample(html: string, note: string): void;
  readonly history: StateHistory<HistoryEntry>;
};

// src/phase1/page/samples.ts
function renderSampleTabs(
  tabs: HTMLElement,
  hint: HTMLElement,
  samples: readonly Sample[],
  onSelect: (sample: Sample) => void,
): void;
```

`loadSample(html, note)`

- `html: string` — 새 샘플 HTML 코드. (예: `SAMPLES[3].html`)
- `note: string` — 기록 목록 패널의 첫 기록 설명. (예: `'샘플 "key 이동"으로 로드'`)
- 반환값: 없음.
- 부수 효과: 두 코드 칸, 두 영역, State History, 요약 문구, 강조 표시, 2차 패널을 그 샘플로 처음부터 다시 만들어요. `page.history`는 새 State History를 가리켜요.

`renderSampleTabs(tabs, hint, samples, onSelect)`

- `tabs: HTMLElement` — 탭 버튼을 넣을 요소 노드. (예: `<div id="sample-tabs" role="tablist">`)
- `hint: HTMLElement` — 고른 탭의 안내를 넣을 요소 노드. (예: `<p id="sample-hint">`)
- `samples: readonly Sample[]` — 그릴 샘플. 첫 번째를 고른 상태로 그려요. (예: `SAMPLES`)
- `onSelect: (sample) => void` — 다른 탭을 누르면 불러요. 지금 고른 탭을 다시 누르면 부르지 않아요.
- 반환값: 없음.
- 부수 효과: `tabs` 안에 버튼을 만들고, 클릭하면 `aria-selected`와 안내 문구를 바꿔요.

## 동작 방식

### loadSample

1. 지난 강조 표시를 지우고, 요약 문구와 마지막 변경 목록(`lastSummary`)을 비워요.
2. 로드 단계(FR-W02~W07)를 그 샘플로 다시 실행해요. 두 코드 칸에 샘플을 넣고, 실제 영역에 `innerHTML`로 넣고, `toVNode`로 트리를 만들고, `createHistory`로 새 State History를 만들고, 테스트 영역을 그려요.
3. 기록 목록 패널의 설명을 `[note]` 하나로 바꿔요.
4. 버튼 상태와 2차 패널을 다시 그려요. 뒤로·앞으로 버튼은 기록이 하나라 비활성이에요.

로드와 `loadSample`은 같은 내부 함수 `load(html, note)`를 불러요. 처음 로드는 `load(sample, '샘플 HTML 코드로 로드')`예요.

### renderSampleTabs

1. 샘플마다 `button[role=tab]`을 만들어 `label`을 쓰고, 첫 번째에만 `aria-selected="true"`를 붙여요.
2. `hint`에 첫 번째 샘플의 `hint`를 써요.
3. 버튼을 누르면 고른 탭만 `aria-selected="true"`로 바꾸고, `hint`를 바꾸고, `onSelect(sample)`을 불러요.

### 모듈을 묶는 곳 (`src/phase1/page/main.ts`)

```ts
const page = createPage(getElements(document), SAMPLES[0].html, engine, { highlight });
const tabs = document.getElementById('sample-tabs');
const hint = document.getElementById('sample-hint');
if (tabs && hint) renderSampleTabs(tabs, hint, SAMPLES, (s) => page.loadSample(s.html, `샘플 "${s.label}"로 로드`));
```

예시 (key 이동):

```text
입력: "key 이동" 탭 클릭 → 테스트 영역 코드에서 c 줄을 맨 위로 옮김 → Patch
출력: 기록 1 / 1, 기록 목록 "샘플 "key 이동"으로 로드"
      Patch 뒤 Diff 패널: move [0,1] a · [0,0]에서 옮김, move [0,2] b · [0,1]에서 옮김
      (ADR-011: 뒤로 돌아간 a, b가 이동이에요. 실제 영역의 li 세 개는 같은 DOM 객체예요)
```

## 설계 결정

| 결정                                                                                 | 이유                                                                                                                                         | 관련 ADR |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Diff 규칙은 바꾸지 않고, 공백 없는 샘플로 key 비교를 보여 준다                             | 공백 노드를 key 판단에서 빼면 `diffKeyed`, `hasUniqueKeys`도 바꿔야 하고 공백 추가·삭제가 Diff 결과를 채워요. 샘플만 바꾸면 ADR이 필요 없어요 | [ADR-002](../../adr/ADR-002.md), [ADR-007](../../adr/ADR-007.md), [ADR-011](../../adr/ADR-011.md) |
| 줄바꿈은 닫는 `>` 앞에 둔다                                                              | 여러 줄로 읽기 쉬우면서 `li` 사이에 텍스트 노드가 생기지 않아요. 한 줄 = 항목 하나라 줄을 옮기면 순서가 바뀌어요                               | [ADR-007](../../adr/ADR-007.md) |
| key 있는 탭과 key 없는 탭을 같은 목록으로 나란히 둔다                                     | 같은 수정에서 key가 있으면 `move`, 없으면 `text`만 나와 차이를 바로 비교할 수 있어요                                                          | [ADR-002](../../adr/ADR-002.md) |
| 탭을 고르면 고치던 입력과 기록을 묻지 않고 버린다                                         | 확인 창(`confirm`)은 화면을 멈춰요. 샘플은 언제든 다시 고를 수 있어 잃을 것이 적어요                                                          | -        |
| `loadSample`은 `createPage`의 로드 단계와 같은 함수로 다시 만든다                         | 로드와 샘플 선택의 결과가 다르면 FR-W02~W07 테스트를 두 번 써야 해요. 한 함수면 한 번 확인으로 충분해요                                         | -        |
| State History는 새로 만들고 `page.history`는 getter로 지금 것을 돌려준다                   | State History에 "비우기" 함수가 없고(history.md), 만들기만 하면 기록 1개로 시작해요                                                            | -        |
| 탭은 `phase1.html`에 빈 자리(`#sample-tabs`, `#sample-hint`)만 두고 버튼은 코드로 만든다    | 샘플 목록이 `samples.ts` 한 곳에 있어 탭을 더할 때 HTML을 고치지 않아요. 자리가 없으면 탭 없이 동작해요                                       | -        |

## 경계 케이스

| 경우                                  | 입력 예시                                  | 기대 동작                                                                       | 관련 요구사항 |
| ------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------- | ------------- |
| Patch를 여러 번 한 뒤 샘플 선택        | 기록 3개, 현재 위치 2에서 탭 클릭           | 기록이 1개, 현재 위치 0, 뒤로·앞으로 버튼 비활성                                 | FR-X05        |
| 입력 중 샘플 선택                     | 테스트 코드를 고치고 Patch 전에 탭 클릭     | 고치던 코드는 버리고 두 코드 칸이 샘플과 같아요. Patch 버튼은 비활성               | FR-X05, W10   |
| 강조 표시가 남아 있을 때 샘플 선택    | Patch 직후 탭 클릭                          | 강조 표시와 Diff 패널, 요약 문구가 지워져요                                       | FR-X05        |
| 지금 고른 탭을 다시 누름              | "기본" 상태에서 "기본" 클릭                 | 아무것도 하지 않아요. 고치던 코드도 남아요                                        | FR-X05        |
| key 탭에서 공백을 넣음                | `</li>\n  <li key="b">`처럼 고침            | 공백 노드가 생겨 같은 자리 비교로 돌아가요. `move`가 나오지 않는 것도 안내대로예요 | FR-X05        |
| key 탭에서 앞에 항목 추가             | `><li key="z">새 일</li` 줄을 맨 위에 넣음  | `create` 하나만 나와요. a, b, c는 순서가 그대로라 이동이 아니에요(ADR-011)          | FR-X05        |

## 검증 방법

- 단위 테스트: `page.test.ts`에서 Patch로 기록을 늘린 뒤 `page.loadSample(SAMPLES[3].html, …)`을 불러, 두 코드 칸과 `history.current().html`이 샘플과 같고 `history.length`가 1인지, 두 영역이 같은지(FR-W15) 확인해요. `keyed-move` 샘플에서 순서를 바꿔 Patch하면 Diff 결과가 `KEYED`이고 `li`가 같은 객체로 남는지, `index-move`에서는 배열 결과인지 확인해요. `renderSampleTabs`는 버튼 수, 첫 탭의 `aria-selected`, 클릭 때 `onSelect` 호출과 안내 문구를 확인해요. 샘플마다 `sanitize`가 빼는 것이 없는지도 봐요.
- 검증 페이지: 탭 다섯 개를 차례로 눌러 안내대로 고치고 Patch해 표의 Diff가 나오는지 봐요. "key 이동"과 "key 없이 순서 바꾸기"에서 같은 줄 옮기기를 해 Diff 패널이 `move`와 `text`로 다르게 나오는지 확인해요.

## 정하지 않은 것

- 관련 이슈: 샘플 선택만 다루는 이슈가 없어 검증 페이지 구현 이슈(#82)를 적었어요. 새 이슈를 만들면 바꿔요.
- 공백 노드를 key 판단에서 뺄지: 이 문서는 샘플로 해결해요. Diff 규칙을 바꾸려면 ADR-002, ADR-011을 잇는 새 ADR에서 정해요.

## 관련 문서

- [요구사항 명세서](../../requirements/phase1/phase1_requirement.md)
- [검증 페이지 설계](page.md), [화면 스타일 설계](style.md), [State History 설계](history.md), [Diff 설계](diff.md)
- [ADR-002](../../adr/ADR-002.md), [ADR-007](../../adr/ADR-007.md), [ADR-011](../../adr/ADR-011.md)
