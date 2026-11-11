# 할 일 앱 자식 컴포넌트 설계

- 상태: 작성 중
- 작성자: 오동환
- 관련 이슈: #93

## 개요

자식 컴포넌트는 루트 컴포넌트 `App`에게 받은 props만으로 입력 영역, 필터 영역, 목록, 아래 영역을 그리고, 사용자 동작은 props로 받은 함수를 불러 알려요. Hook을 부르지 않고 같은 props에 늘 같은 VNode를 돌려줘요. 이 문서를 읽으면 컴포넌트 다섯 개의 props와 VNode 모양, 목록 항목에 key를 붙이는 곳, 요소마다 붙이는 class를 알고 `src/phase2/page/components.ts`를 구현할 수 있어요. class 이름과 모양은 [화면 스타일 설계](style.md)가 정하고, 이 문서는 그 이름을 어느 요소에 붙이는지 정해요.

## 다루는 요구사항

| ID      | 요구사항 요약                                                                 | 이 문서에서 다루는 곳                |
| ------- | ----------------------------------------------------------------------------- | ------------------------------------ |
| FR-AP03 | 할 일 앱 페이지가 로드되면 입력 영역, 필터 영역, 목록, 아래 영역을 보여 줘요     | 자료구조                             |
| FR-AD05 | 입력창에 포커스가 있는 동안 Enter를 누르면 추가 버튼을 누른 것과 같이 추가해요   | 동작 방식 (`TodoInput`)              |
| FR-AD06 | IME 조합 중에 Enter가 눌리면 할 일을 추가하지 않아요                           | 동작 방식 (`TodoInput`), 설계 결정   |
| FR-AD08 | 앞뒤 공백을 지운 입력값이 빈 문자열인 동안 추가 버튼을 비활성화해요             | 동작 방식 (`TodoInput`)              |
| FR-DN02 | 끝낸 일의 항목을 남은 일의 항목과 다른 모양으로 보여 줘요                       | 자료구조, 설계 결정                  |
| FR-DN03 | 할 일 하나의 `done`이 바뀌면 다른 할 일의 항목 DOM을 바꾸지 않아요               | 동작 방식, 경계 케이스               |
| FR-RM02 | 할 일이 목록에서 빠지면 남은 할 일의 항목을 같은 DOM 노드로 유지해요             | 설계 결정, 경계 케이스               |
| FR-FL03 | 지금 고른 필터의 버튼을 다른 필터 버튼과 다른 모양으로 보여 줘요                 | 자료구조, 설계 결정                  |
| FR-FL05 | 보이는 목록이 비어 있는 동안 목록 자리에 안내 문구를 보여 줘요                   | 동작 방식 (`TodoList`), 설계 결정    |
| FR-CL02 | 끝낸 일이 하나도 없는 동안 끝낸 일 지우기 버튼을 비활성화해요                    | 동작 방식 (`Footer`)                 |
| FR-CT01 | 아래 영역에 남은 일 개수를 보여 줘요                                           | 동작 방식 (`Footer`)                 |
| FR-AS06 | 목록 항목은 할 일의 `id`를 key로 가져요                                         | 동작 방식 (`TodoList`), 설계 결정    |
| FR-AS07 | 자식 컴포넌트는 사용자 동작을 props로 받은 함수로 루트 컴포넌트에 알려요          | 인터페이스, 동작 방식                |
| FR-AX05 | (2차) 순서 바꾸기가 포함되면 위·아래 이동 버튼으로 이웃 할 일과 자리를 바꿔요    | 동작 방식 (`TodoItem`)               |
| FR-AX06 | (2차) 순서 바꾸기가 포함되면 보이는 목록의 맨 위 위로 버튼과 맨 아래 아래로 버튼을 비활성화해요 | 동작 방식 (`TodoItem`), 경계 케이스 |

## 위치와 흐름

```text
App(render) → h(자식 컴포넌트, props) → 자식 컴포넌트 → 요소 VNode → App의 div.todo-app
사용자 입력·클릭 → 자식 요소의 핸들러 → props의 함수 → App의 동작 함수(setState)
```

- 입력을 주는 곳: [할 일 앱 루트 컴포넌트](todo-app.md)의 `App`(props), 브라우저 이벤트([props 반영](props.md)이 등록한 핸들러)
- 출력을 받는 곳: [할 일 앱 루트 컴포넌트](todo-app.md)의 `App`(돌려준 VNode, props로 받은 동작 함수 호출)

## 자료구조

```ts
// src/phase2/page/components.ts
type TodoInputProps = {
  text: string;
  onInput: (value: string) => void;
  onAdd: () => void;
};

type FilterBarProps = {
  filter: Filter;
  onChange: (filter: Filter) => void;
};

type TodoListProps = {
  todos: Todo[];
  filter: Filter;
  onToggle: (id: number) => void;
  onRemove: (id: number) => void;
  onMove?: (id: number, dir: -1 | 1) => void; // 2차 (FR-AX05)
};

type TodoItemProps = {
  todo: Todo;
  onToggle: (id: number) => void;
  onRemove: (id: number) => void;
  onMove?: (id: number, dir: -1 | 1) => void; // 2차
  isFirst?: boolean;                           // 2차
  isLast?: boolean;                            // 2차
};

type FooterProps = {
  remaining: number;
  hasDone: boolean;
  onClearDone: () => void;
};
```

- `text: string` — 입력값 state. 입력창의 `value`로 넘겨요. (예: `'우유'`)
- `onInput`, `onAdd` — App의 `changeText`, `addTodo`. (예: `onInput('우유')`)
- `filter: Filter` — 지금 필터. `FilterBar`는 선택 표시에, `TodoList`는 안내 문구에 써요. (예: `'active'`)
- `onChange` — App의 `setFilter`. (예: `onChange('done')`)
- `todos: Todo[]` — 그릴 할 일. `TodoList`에는 보이는 목록(`visible`)을 넘겨요. (예: `[{ id: 1, text: '우유', done: false }]`)
- `onToggle`, `onRemove` — App의 `toggleTodo`, `removeTodo`. 할 일의 `id`를 넘겨 불러요. (예: `onToggle(1)`)
- `onMove`, `isFirst`, `isLast` — 2차 순서 바꾸기. 없으면 이동 버튼을 그리지 않아요.
- `remaining: number` — 남은 일 개수. (예: `2`)
- `hasDone: boolean` — 끝낸 일이 하나라도 있으면 `true`. (예: `false`)
- `onClearDone` — App의 `clearDone`.
- 모든 props 타입에는 h가 넣는 `children: VNode[]`가 더해져요. 이 컴포넌트들은 `children`을 쓰지 않아요.

App이 그리는 VNode 트리와 class 이름이에요. 이름은 [화면 스타일 설계의 "앱 컴포넌트가 붙이는 class"](style.md#앱-컴포넌트가-붙이는-class) 표를 따르고, `style.css`는 이 class 이름에만 모양을 붙여요.

```text
div.todo-app
├─ div.todo-input-row         ← TodoInput (입력 영역)
│  ├─ input.todo-input        [type=text, placeholder="할 일을 입력하세요", value, onInput, onKeyDown]
│  └─ button.todo-add         [disabled, onClick] "추가"
├─ div.todo-filters[role=group] ← FilterBar (필터 영역)
│  └─ button.todo-filter(.is-selected) × 3  [onClick] "전체" / "남은 일" / "끝낸 일"
├─ ul.todo-list               ← TodoList (목록). 보이는 목록이 비면 이 자리에 p.todo-empty
│  └─ li.todo-item(.is-done) [key=id] × 보이는 목록   ← TodoItem
│     ├─ input.todo-check     [type=checkbox, checked, onChange]
│     ├─ span.todo-text       글자
│     ├─ button.todo-move × 2 (2차) [aria-label, disabled, onClick] "↑" / "↓"
│     └─ button.todo-delete   [aria-label="<글자> 삭제", onClick] "삭제"
└─ div.todo-footer            ← Footer (아래 영역)
   ├─ span                    "남은 일 " strong.todo-count "2" "개"
   └─ button.todo-clear       [disabled, onClick] "끝낸 일 지우기"
```

- `.is-done` — 끝낸 일의 `li`에만 붙어요. 글자에 가운뎃줄을 긋고 회색으로 보여요. (FR-DN02)
- `.is-selected` — 지금 필터의 버튼에만 붙어요. 배경을 채워 보여요. (FR-FL03)
- 네 영역의 class(`todo-input-row`, `todo-filters`, `todo-list` 또는 `todo-empty`, `todo-footer`)가 FR-AP03 테스트가 찾는 이름이에요.

## 인터페이스

```ts
function TodoInput(props: TodoInputProps): VNode;
function FilterBar(props: FilterBarProps): VNode;
function TodoList(props: TodoListProps): VNode;
function TodoItem(props: TodoItemProps): VNode;
function Footer(props: FooterProps): VNode;
function emptyMessage(filter: Filter): string;
```

- 컴포넌트 다섯 개는 App이 `h(TodoInput, { text, onInput: changeText, onAdd: addTodo })`처럼 부르고, `TodoItem`은 `TodoList`가 불러요. 테스트도 `h`로 불러 VNode를 확인할 수 있어요.
- 반환값: 위 트리에서 각자 맡은 요소 VNode 하나. (예: `TodoInput` → `div.todo-input-row`)
- 부수 효과: 없음. 핸들러가 불릴 때만 props의 함수를 불러요. ([FR-A06~A08](../../requirements/phase2/function-component_requirement.md#54-앱-작성-규칙))

`emptyMessage(filter)`

- `filter: Filter` — 지금 필터.
- 반환값: 안내 문구. `'all'` → `'할 일이 없어요. 위에서 추가해 보세요.'`, `'active'` → `'남은 일이 없어요.'`, `'done'` → `'끝낸 일이 없어요.'`
- 부수 효과: 없음.

## 동작 방식

### TodoInput

1. 입력창에 `value: text`를 넘겨요. ([제어 입력](props.md#경계-케이스))
2. `onInput`: `e => onInput((e.target as HTMLInputElement).value)` (FR-AD01)
3. `onKeyDown`: `e.key === 'Enter'`이고 IME 조합 중이 아니면 `onAdd()`를 불러요. 조합 중은 `e.isComposing || e.keyCode === 229`로 봐요. (FR-AD05, AD06)
4. 추가 버튼은 `disabled: text.trim() === ''`, `onClick: () => onAdd()`예요. (FR-AD08) 빈 입력을 막는 일은 App의 `addTodo`도 해요. (FR-AD07)

### FilterBar

1. `FILTERS` 순서대로 버튼 세 개를 그려요.
2. `class`는 `value === filter`면 `'todo-filter is-selected'`, 아니면 `'todo-filter'`예요. (FR-FL03)
3. `onClick: () => onChange(value)` (FR-FL01)

### TodoList

1. `todos`가 비면 `p.todo-empty`에 `emptyMessage(filter)`를 넣어 돌려줘요. (FR-FL05)
2. 아니면 `ul.todo-list` 안에 `todos.map(todo => h(TodoItem, { key: todo.id, todo, onToggle, onRemove }))`를 넣어 돌려줘요. (FR-AS06)

### TodoItem

1. `li`의 `class`는 `todo.done`이면 `'todo-item is-done'`, 아니면 `'todo-item'`이에요. (FR-DN02)
2. 체크박스는 `checked: todo.done`, `onChange: () => onToggle(todo.id)`예요. (FR-DN01)
3. 삭제 버튼은 `aria-label`에 "<글자> 삭제"(예: `'우유 삭제'`)를 쓰고, `onClick: () => onRemove(todo.id)`예요. (FR-RM01)
4. (2차) `onMove`가 있으면 글자 뒤에 `button.todo-move` 두 개(↑, ↓)를 넣고 `aria-label`에 "<글자> 위로 이동"처럼 써요. `isFirst`면 ↑를, `isLast`면 ↓를 비활성화해요. `TodoList`가 보이는 목록에서의 자리로 `isFirst`, `isLast`를 넘겨요. (FR-AX05, AX06)

### Footer

1. `h('span', null, '남은 일 ', h('strong', { class: 'todo-count' }, remaining), '개')`로 "남은 일 **N**개"를 써요. (FR-CT01)
2. 지우기 버튼은 `disabled: !hasDone`, `onClick: () => onClearDone()`예요. (FR-CL02)

예시 (가운데 항목 체크):

```text
입력: visible = [{1,'우유',false}, {2,'빵',false}, {3,'잼',false}], 2번 체크박스 클릭
출력: onToggle(2) → App이 2번만 새 객체로 바꿔 update
      Diff(KEYED): li#1 — 핸들러 2개만 바뀜, li#2 — class 'todo-item is-done', checked true, li#3 — 핸들러 2개만 바뀜
      li 세 개는 같은 DOM 객체로 남고, li#1·li#3의 attribute는 그대로예요 (FR-DN03)
      Footer: "남은 일 3개" → "남은 일 2개", 지우기 버튼의 disabled가 풀려요
```

## 설계 결정

| 결정                                                                                     | 이유                                                                                                                                       | 관련 ADR |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 자식 컴포넌트는 영역마다 하나(`TodoInput`, `FilterBar`, `TodoList`, `Footer`)와 항목 하나(`TodoItem`)로 나눈다 (요구사항 6.1) | 4.1 화면 구성과 1:1이라 발표에서 화면을 가리키며 코드를 보여 주기 쉬워요. 항목을 따로 두면 key를 붙이는 곳이 한 줄로 보여요                   | -        |
| key는 `TodoList`가 `h(TodoItem, { key: todo.id, … })`로 붙인다                              | h가 key를 컴포넌트 결과 `li`에 옮겨요([FR-H09](../../requirements/phase2/h-props_requirement.md)). `TodoItem`은 key를 몰라도 돼요              | [ADR-011](../../adr/ADR-011.md) |
| `ul` 안에는 key가 있는 `li`만 두고, 보이는 목록이 비면 `ul` 자리에 `p.todo-empty`를 그린다 | Diff는 형제가 모두 key를 가질 때만 key로 짝지어요. 안내 문구를 `ul` 안에 섞으면 같은 인덱스 비교로 돌아가 FR-RM02가 깨져요. `ul`의 형제로 덧붙이면 아래 영역의 인덱스가 밀려 아래 영역이 통째로 바뀌어요. 같은 자리에서 바꾸면 아래 영역은 그대로예요 | [ADR-011](../../adr/ADR-011.md) |
| 안내 문구는 필터마다 다르게 한다 (요구사항 6.1)                                              | `남은 일` 필터에서 모두 체크했을 때(FR-FL04) "추가해 보세요"는 상황과 맞지 않아요                                                             | -        |
| 체크박스는 `onChange`로 받는다                                                              | 클릭과 키보드(Space) 모두에서 `change`가 일어나요. `click`보다 "체크가 바뀜"이라는 뜻이 분명해요                                                 | -        |
| IME 조합 중은 `isComposing`과 `keyCode === 229`를 함께 본다                                  | Safari는 조합을 끝내는 Enter의 `keydown`에서 `isComposing`이 `false`이고 `keyCode`만 229예요. 하나만 보면 Safari에서 두 번 추가돼요             | -        |
| `form`을 쓰지 않고 `keydown`으로 Enter를 받는다                                              | `form`의 submit은 IME 조합 중 Enter를 걸러 내지 못하고, 페이지 이동을 막는 처리가 더 필요해요                                                   | -        |
| 모양은 class로만 바꾸고 `style` props를 쓰지 않는다                                          | Diff 결과에 `class` 하나만 나와 발표에서 읽기 쉬워요. 모양은 `src/phase2/page/style.css` 한 곳에서 바꿔요                                         | -        |
| class 이름은 [화면 스타일 설계](style.md)의 표를 그대로 쓴다                                  | 모양과 이름을 한 문서에서 정해야 `style.css`와 컴포넌트가 어긋나지 않아요. 상태 class(`is-done`, `is-selected`)만 붙었다 떨어져 테스트가 찾기 쉬워요 | -        |

## 경계 케이스

| 경우                             | 입력 예시                                                    | 기대 동작                                                                                   | 관련 요구사항 |
| -------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------- |
| 한글 입력 뒤 Enter               | `keydown { key: 'Enter', isComposing: true }`                | `onAdd`를 부르지 않아요. 확정 뒤 Enter 한 번에 한 번만 추가돼요                              | FR-AD06       |
| Safari의 조합 확정 Enter         | `keydown { key: 'Enter', isComposing: false, keyCode: 229 }` | `onAdd`를 부르지 않아요                                                                    | FR-AD06       |
| 공백만 입력                      | `text = '  '`                                                | 추가 버튼이 `disabled`예요. Enter는 `onAdd`를 부르지만 App이 추가하지 않아요                 | FR-AD07, AD08 |
| 입력 중 다시 그리기              | 사용자가 `'우유'` 입력 → `value: '우유'`로 Patch              | 값이 같아 입력창의 글자와 커서가 그대로예요                                                  | FR-AD01       |
| 다른 항목의 핸들러               | 2번 체크 뒤 1번 `li`                                         | 새 핸들러로 바뀌지만 DOM 노드와 attribute는 그대로예요                                        | FR-DN03       |
| 가운데 항목 삭제                 | `[li#1, li#2, li#3]` → `[li#1, li#3]`                         | Diff(KEYED)가 `li#2`만 지워요. `li#1`, `li#3`은 같은 객체이고 체크 상태도 남아요               | FR-RM02       |
| 마지막 항목 삭제                 | `[li#1]` → `[]`                                              | `ul.todo-list` 자리가 `p.todo-empty`로 바뀌어요(REPLACE). 아래 영역은 같은 DOM으로 남아요       | FR-FL05       |
| 끝낸 일 필터, 끝낸 일 없음       | `filter = 'done'`, 모두 `done: false`                        | `'끝낸 일이 없어요.'`가 보여요                                                              | FR-FL05       |
| 끝낸 일 없음                     | `hasDone = false`                                            | 지우기 버튼이 `disabled`예요. 하나를 체크하면 풀려요                                          | FR-CL02       |
| 첫 항목의 위로 버튼 (2차)        | `isFirst = true`                                             | `▲`가 `disabled`예요                                                                        | FR-AX06       |

## 검증 방법

- 단위 테스트: App을 jsdom 컨테이너에 mount해 네 영역의 class가 있는지(FR-AP03) 확인해요. `keydown` 이벤트를 `isComposing`과 `keyCode`를 바꿔 보내 FR-AD05, AD06을, 버튼의 `disabled`로 FR-AD08, CL02를, `is-done`과 `is-selected`로 FR-DN02, FL03을 확인해요. FR-DN03, RM02는 이벤트 전후 `li`를 `===`로 비교하고 `getAttribute('class')`, `checked`를 봐요. 컴포넌트 하나만 `h(TodoItem, { key: 1, todo, … })`로 불러 VNode의 `key`가 `'1'`인지(FR-AS06)도 확인해요.
- 검증 페이지: `phase2.html`에서 한글을 입력하고 Enter를 눌러 한 번만 추가되는지(Chrome, Safari) 봐요. 개발자 도구 Elements 패널에서 체크 한 번에 그 `li`만 깜빡이는지, 가운데 항목을 지워도 다른 `li`가 다시 만들어지지 않는지 봐요. 코드 리뷰로 컴포넌트 파일에 Hook 호출과 `document` 접근이 없는지(FR-AS07, A05~A08) 확인해요.

## 관련 문서

- [요구사항 명세서: 할 일 앱](../../requirements/phase2/app_requirement.md)
- [할 일 앱 루트 컴포넌트 설계](todo-app.md), [페이지 구성 설계](app-pages.md)
- [화면 스타일 설계](style.md), [h 함수 설계](h.md), [props 반영 설계](props.md), [Diff 설계 (Phase 1)](../phase1/diff.md)
- [ADR-011](../../adr/ADR-011.md)
