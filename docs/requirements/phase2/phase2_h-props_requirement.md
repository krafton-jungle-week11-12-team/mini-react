# Mini React Phase 2 요구사항 명세서: h 함수 · props 처리

| 항목      | 내용                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------- |
| 문서 상태 | 초안 v0.1                                                                                               |
| 작성일    | 2026-11-10                                                                                              |
| 수정일    | -                                                                                                       |
| 작성자    | 오동환                                                                                                  |
| 근거      | Discussions #103 (h 함수 · 이벤트 props · attribute vs property), #105 (App이 return한 VNode는 어디로 가는가) |
| 선행 문서 | [phase1_requirement.md](../phase1/phase1_requirement.md)                                                |
| 작성 규칙 | 요구사항 문장은 EARS 형식(항상, 이벤트, 상태, 오류, 선택)을 따르고, 요구사항 하나에 동작 하나만 담는다. |

---

## 1. 목표

- 컴포넌트가 VNode 객체를 직접 쓰지 않고 `h(tag, props, ...children)`로 VNode 트리를 만들 수 있게 한다.
- props로 넘긴 이벤트 핸들러가 DOM 이벤트에 연결되고, 리렌더링 뒤에도 최신 핸들러 하나만 동작하게 한다.
- `value`, `checked`, `selected` props가 바뀌면 화면에 보이는 값도 같이 바뀌게 한다.

## 2. 범위

### 2.1 포함

- h 함수
  - 태그 이름, props, 자식으로 요소 VNode 만들기
  - 자식 정리 (배열 펼치기, 조건부 렌더링 값 버리기, 문자열·숫자를 텍스트 VNode로 바꾸기)
  - `tag`가 함수(자식 컴포넌트)이면 바로 실행하기
- 이벤트 props
  - DOM을 처음 만들 때 이벤트 핸들러 등록
  - Patch할 때 이벤트 핸들러 교체, 제거
- attribute · property
  - `value`, `checked`, `selected`를 property로 반영

### 2.2 제외

| 제외 항목                                      | 이유                                                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| JSX                                            | Vanilla JS 과제라 JSX 변환 도구가 없다. h 함수를 직접 호출한다.                                              |
| FunctionComponent, useState                    | [phase2_function-component_requirement.md](phase2_function-component_requirement.md)에서 다룬다.             |
| useMemo, useEffect                             | 각 Phase 2 문서에서 다룬다.                                                                                  |
| 자식 컴포넌트의 state                          | h가 자식 컴포넌트를 바로 실행하므로 자식은 state 없는 순수 함수로 둔다. state 제약은 FunctionComponent 문서에서 다룬다. |
| 이벤트 위임, 요소마다 핸들러 하나만 거는 방식 | 이벤트 핸들러는 이전 것을 지우고 새 것을 등록하는 방식(remove + add)으로 처리하기로 했다. (#103)             |

## 3. 용어

> Phase 1 용어는 [phase1_requirement.md 3절](../phase1/phase1_requirement.md#3-용어)을 따른다.

| 용어          | 뜻                                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| h 함수        | `h(tag, props, ...children)`. VNode를 만들어 돌려주는 함수. hyperscript의 줄임말이다.                   |
| props         | h의 두 번째 인자. 속성과 이벤트 핸들러를 담은 객체. `null`일 수 있다.                                   |
| 이벤트 props  | 이름이 `on`으로 시작하고 값이 함수인 props. (예: `onClick`)                                              |
| 자식 컴포넌트 | h의 `tag` 자리에 넘긴 함수. props를 받아 VNode를 돌려준다.                                               |
| attribute     | HTML에 적힌 초깃값. `el.getAttribute('value')`로 읽는다.                                                 |
| property      | 지금 화면에 보이는 값. `el.value`로 읽는다.                                                               |
| 제어 컴포넌트 | 입력 요소의 `value`를 state로 정하고 `onInput`으로 state를 고쳐, state와 화면 값을 맞추는 방식            |

## 4. 동작 흐름

### 4.1 h로 VNode 트리 만들기

1. 인자가 먼저 계산되므로 안쪽 h부터 실행된다.
2. `tag`가 함수이면 `tag({ ...props, children })`을 실행하고, 그 결과 VNode를 그대로 돌려준다. 트리에는 자식 컴포넌트의 흔적이 남지 않는다.
3. `tag`가 문자열이면 자식을 정리한다.
   1. 배열은 펼친다.
   2. `null`, `undefined`, `true`, `false`는 버린다.
   3. 문자열과 숫자는 텍스트 VNode로 바꾼다.
4. `{ kind: 'element', tag, props, children }`을 돌려준다. props가 `null`이면 빈 객체로 둔다.

### 4.2 DOM을 처음 만들 때 props 반영 (toDOM)

1. 이벤트 props는 `addEventListener`로 등록한다. 이벤트 이름은 `on`을 뺀 나머지를 소문자로 바꾼 것이다. (`onClick` → `click`)
2. `value`, `checked`, `selected`는 property로 넣는다. (`el.value = value`)
3. 나머지 props는 Phase 1처럼 `setAttribute`로 붙인다.

### 4.3 Patch할 때 props 반영

1. 이벤트 핸들러가 바뀌었으면 이전 핸들러를 `removeEventListener`로 지우고 새 핸들러를 `addEventListener`로 등록한다.
   - 리렌더링마다 컴포넌트 함수가 다시 실행되어 핸들러가 새로 만들어진다.
   - `removeEventListener`는 등록할 때와 같은 함수 참조가 있어야 지울 수 있으므로, 이전 VNode의 핸들러가 필요하다. 이를 Patch에 넘기는 방법은 미정이다. (6절)
2. `value`, `checked`, `selected`가 바뀌었으면 property를 바꾼다. 없어졌으면 빈 값(`''`, `false`)으로 바꾼다.
3. 나머지 props는 Phase 1처럼 `setAttribute`, `removeAttribute`로 바꾼다.

## 5. 기능 요구사항

> 확인 방법은 초안이다. 테스트 문서를 작성할 때 구체화한다.
> 비고 열의 "삭제됨"은 번호를 유지하기 위해 남긴 행이다.
> 비고 열의 "미정"은 6절의 결정에 따라 요구사항이 바뀔 수 있다는 뜻이다.

### 5.1 h 함수

| ID     | 유형              | 요구사항                                                                                                                         | 확인 방법 (초안)                                                                                                    | 비고                    |
| ------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| FR-H01 | 이벤트 (When)     | 태그 이름으로 h가 호출되면, 시스템은 그 태그, props, 자식을 가진 요소 VNode를 돌려줘야 한다.                                     | `h('button', { class: 'btn' }, '0')`이 `{ kind: 'element', tag: 'button', props: { class: 'btn' }, children: [텍스트 '0'] }`인지 확인 |                         |
| FR-H02 | 이벤트 (When)     | props를 `null`로 넘겨 h가 호출되면, 시스템은 빈 객체를 props로 가진 VNode를 돌려줘야 한다.                                        | `h('span', null).props`가 `{}`인지 확인                                                                             |                         |
| FR-H03 | 항상 (Ubiquitous) | 시스템은 h에 넘긴 자식 중 배열을 펼쳐, 배열 안의 노드를 자식으로 넣어야 한다.                                                    | `h('ul', null, [li1, li2])`와 `h('ul', null, [[li1], li2])`의 자식이 모두 `li1`, `li2` 두 개인지 확인                 | `todos.map(...)` 대응   |
| FR-H04 | 항상 (Ubiquitous) | 시스템은 h에 넘긴 자식 중 `null`, `undefined`, `true`, `false`를 자식으로 넣지 않아야 한다.                                       | `h('div', null, false, null, undefined, true, 'A')`의 자식이 텍스트 `'A'` 하나인지 확인                              | 조건부 렌더링 대응      |
| FR-H05 | 항상 (Ubiquitous) | 시스템은 h에 넘긴 문자열과 숫자 자식을 텍스트 VNode로 바꿔야 한다.                                                                | `h('span', null, 0)`의 자식이 텍스트 `'0'` 하나인지 확인                                                            | 엣지 케이스: 숫자 `0`도 넣는다 |
| FR-H06 | 이벤트 (When)     | 함수를 `tag`로 넘겨 h가 호출되면, 시스템은 그 함수를 props와 `children`을 합친 객체로 바로 실행하고 그 결과 VNode를 돌려줘야 한다. | `h(TodoList, { todos })`의 결과가 `TodoList`가 돌려준 `ul` VNode와 같고, 트리에 `TodoList`를 나타내는 노드가 없는지 확인 |                         |

### 5.2 이벤트 props

| ID     | 유형              | 요구사항                                                                                                                    | 확인 방법 (초안)                                                                                                     | 비고                                     |
| ------ | ----------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| FR-P01 | 이벤트 (When)     | VNode를 DOM으로 만들 때 이벤트 props가 있으면, 시스템은 그 핸들러를 `addEventListener`로 등록해야 한다.                     | `onClick` 핸들러를 가진 버튼 VNode를 DOM으로 만든 뒤 클릭하면 핸들러가 한 번 실행되는지 확인                         | VNode 타입 변경 후 적용 (6절, 미정)      |
| FR-P02 | 항상 (Ubiquitous) | 시스템은 이벤트 props를 attribute로 붙이지 않아야 한다.                                                                     | `onClick`을 가진 버튼의 DOM에 `onclick` attribute가 없는지 확인                                                      |                                          |
| FR-P03 | 이벤트 (When)     | Patch할 때 이벤트 핸들러가 바뀌었으면, 시스템은 이전 핸들러를 지우고 새 핸들러를 등록해야 한다.                              | 리렌더링을 여러 번 한 뒤 클릭 한 번에 핸들러가 한 번만 실행되고, 최신 state 값으로 동작하는지 확인                   | 이전 핸들러를 넘기는 방법 미정 (6절)     |
| FR-P04 | 이벤트 (When)     | Patch할 때 이벤트 props가 없어졌으면, 시스템은 이전 핸들러를 지워야 한다.                                                    | `onClick`을 뺀 VNode로 Patch한 뒤 클릭해도 핸들러가 실행되지 않는지 확인                                             | 이전 핸들러를 넘기는 방법 미정 (6절)     |
| FR-P05 | 이벤트 (When)     | Patch할 때 이벤트 props가 새로 생겼으면, 시스템은 그 핸들러를 등록해야 한다.                                                 | `onClick`이 없던 버튼에 `onClick`을 추가해 Patch한 뒤 클릭하면 핸들러가 실행되는지 확인                              |                                          |

### 5.3 attribute · property

| ID     | 유형              | 요구사항                                                                                                                              | 확인 방법 (초안)                                                                                                       | 비고                                |
| ------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| FR-P06 | 항상 (Ubiquitous) | 시스템은 `value`, `checked`, `selected` props를 DOM에 반영할 때 attribute가 아니라 property로 바꿔야 한다.                            | 사용자가 입력창에 "우유"를 입력한 뒤 `value: ''`로 Patch하면 입력창이 비는지 확인                                      | VNode 타입 변경 후 적용 (6절, 미정) |
| FR-P07 | 이벤트 (When)     | Patch할 때 `value`, `checked`, `selected` props가 없어졌으면, 시스템은 그 property를 빈 값(`value`는 `''`, 나머지는 `false`)으로 바꿔야 한다. | `checked: true`인 체크박스에서 `checked`를 뺀 VNode로 Patch하면 체크가 풀리는지 확인                                   |                                     |
| FR-P08 | 항상 (Ubiquitous) | 시스템은 이벤트 props와 FR-P06의 props를 뺀 나머지 props를 Phase 1처럼 attribute로 반영해야 한다.                                      | `id`, `class`를 바꿔 Patch한 뒤 `getAttribute`로 읽은 값이 새 값인지 확인                                              |                                     |

## 6. 설계로 넘기는 항목

> 아래 항목은 모두 **미정**이다.

- VNode 타입 변경: Phase 1의 `VElement.props`는 `Record<string, string>`이라 함수(이벤트 핸들러)와 boolean(`checked: true`)을 담을 수 없다. 타입은 이후에 바꾸기로 했고, 바꿀 형태는 미정이다.
- 이전 핸들러를 Patch에 넘기는 방법: Phase 1의 `PropsPatch`에는 새 값(`set`)과 없어진 속성 이름(`remove`)만 담겨, Patch가 `removeEventListener`에 넘길 이전 핸들러를 알 수 없다.
  - A. `PropsPatch`에 이전 값도 담는다.
  - B. 요소에 지금 핸들러를 저장해 두고 Patch가 거기서 꺼낸다.

## 7. 추후 논의

- 이벤트 이름 변환 규칙을 `on` 뒤를 소문자로 바꾸는 것만으로 충분한지
