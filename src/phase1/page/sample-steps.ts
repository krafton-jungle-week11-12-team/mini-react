// 시연용 샘플 코드 작성
// "샘플 코드 작성" 버튼을 누르면 단계별 HTML 코드를 테스트 영역에 채워, 직접 입력하지 않고 Diff 종류를 확인해요
// - 지금 기록이 어느 단계면 그다음 단계 HTML 코드를 넣어요
// - 단계에 없는 코드면 실제 영역까지 0단계(시작) HTML 코드로 로드해요

/**
 * 시연 단계. 0단계가 시작 상태이고, 1단계부터 Patch 한 번에 한 단계씩 넘어가요.
 * 모든 li가 key를 가져 key 비교가 동작해요 (ADR-011). 줄바꿈은 닫는 `>` 앞에 둬 공백 텍스트 노드가 생기지 않아요.
 */
export const SAMPLE_STEPS: readonly { hint: string; html: string }[] = [
  {
    hint: '0/3 시작: 단계별 시연의 시작 코드로 로드했어요. "샘플 코드 작성"을 눌러 다음 단계 코드를 넣어 보세요.',
    html: `<div id="app"
  ><h1 class="title">할 일 목록</h1
  ><ul class="todo"
    ><li key="a">장보기</li
    ><li key="b">운동하기</li
  ></ul
></div>`,
  },
  {
    hint: '1/3 UPDATE: h1의 글자와 class, 두 번째 li의 글자가 바뀌어요. Patch를 누른 뒤 "샘플 코드 작성"을 다시 눌러 보세요.',
    html: `<div id="app"
  ><h1 class="title done">오늘 할 일</h1
  ><ul class="todo"
    ><li key="a">장보기</li
    ><li key="b">운동하기 30분</li
  ></ul
></div>`,
  },
  {
    hint: '2/3 CREATE: 목록 끝에 li(key="c")가 추가돼요. Patch를 누른 뒤 "샘플 코드 작성"을 다시 눌러 보세요.',
    html: `<div id="app"
  ><h1 class="title done">오늘 할 일</h1
  ><ul class="todo"
    ><li key="a">장보기</li
    ><li key="b">운동하기 30분</li
    ><li key="c">책 읽기</li
  ></ul
></div>`,
  },
  {
    hint: '3/3 MOVE: key="c" li가 맨 위로 옮겨져요. Patch를 누른 뒤 "샘플 코드 작성"을 다시 눌러 보세요.',
    html: `<div id="app"
  ><h1 class="title done">오늘 할 일</h1
  ><ul class="todo"
    ><li key="c">책 읽기</li
    ><li key="a">장보기</li
    ><li key="b">운동하기 30분</li
  ></ul
></div>`,
  },
];

export const STEPS_DONE_HINT = '단계를 모두 마쳤어요. 뒤로·앞으로로 기록을 오가거나 샘플 탭을 골라 보세요.';

/**
 * 지금 기록의 HTML 코드 다음에 쓸 단계를 돌려줘요.
 * 단계에 없는 코드면 0단계를, 마지막 단계면 null을 돌려줘요.
 */
export function nextStep(currentHtml: string): { hint: string; html: string } | null {
  const index = SAMPLE_STEPS.findIndex((step) => step.html === currentHtml);
  if (index + 1 >= SAMPLE_STEPS.length) return null;
  return SAMPLE_STEPS[index + 1];
}
