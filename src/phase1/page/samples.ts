// 샘플 선택 (docs/design/phase1/sample.md, FR-X05)
// Diff 종류별 샘플 HTML 코드와, 샘플을 고르는 탭을 그려요

import { SAMPLE_HTML } from './page';

export type Sample = {
  /** 탭을 가리키는 이름 (예: 'keyed-move') */
  id: string;
  /** 탭에 쓰는 글자 */
  label: string;
  /** 무엇을 고치면 어떤 Diff가 나오는지 알려 주는 안내 한 줄 */
  hint: string;
  /** 샘플 HTML 코드. 끝에 줄바꿈을 붙이지 않아요 */
  html: string;
};

/**
 * key 비교용 샘플은 줄바꿈을 닫는 `>` 앞에 둬요.
 * li 사이에 공백 텍스트 노드가 생기지 않아 모든 형제가 key를 가져요 (ADR-007, ADR-011).
 * 한 줄에 li 하나라 줄을 통째로 옮기면 순서가 바뀌어요.
 */
const KEYED_LIST = `<ul class="todo"
  ><li key="a">장보기</li
  ><li key="b">운동하기</li
  ><li key="c">안녕</li
></ul>`;

const INDEX_LIST = `<ul class="todo"
  ><li>장보기</li
  ><li>운동하기</li
  ><li>안녕</li
></ul>`;

/** 첫 번째가 로드 때의 샘플이에요 (FR-W23). */
export const SAMPLES: readonly Sample[] = [
  {
    id: 'basic',
    label: '기본',
    hint: '요구사항의 샘플이에요. HTML 코드를 자유롭게 고치고 Patch를 눌러 보세요.',
    html: SAMPLE_HTML,
  },
  {
    id: 'text-props',
    label: '글자·속성',
    hint: 'p의 글자나 h1의 class를 바꾸고 Patch를 눌러 보세요. text, props가 나와요.',
    html: `<div id="app">
  <h1 class="title">오늘 할 일</h1>
  <p class="note">글자를 바꿔 보세요</p>
</div>`,
  },
  {
    id: 'add-remove',
    label: '추가·삭제',
    hint: '가운데 li를 지우고 Patch를 눌러 보세요. key가 없어 자리끼리 비교해, 뒤 항목의 글자가 바뀌고 끝이 지워져요.',
    html: `<ul class="todo">
  <li>장보기</li>
  <li>운동하기</li>
  <li>안녕</li>
</ul>`,
  },
  {
    id: 'keyed-move',
    label: 'key 이동',
    hint: 'c 줄을 맨 위로 옮기고 Patch를 눌러 보세요. key로 짝지어 li를 옮기는 move가 나와요. 줄바꿈을 > 앞에 둬 li 사이에 공백 노드가 없어요.',
    html: KEYED_LIST,
  },
  {
    id: 'index-move',
    label: 'key 없이 순서 바꾸기',
    hint: '"key 이동"과 같이 마지막 줄을 맨 위로 옮기고 Patch를 눌러 보세요. key가 없으면 move 없이 글자만 바뀌어요.',
    html: INDEX_LIST,
  },
];

/**
 * 샘플마다 탭 버튼을 만들어요. 첫 번째 탭을 고른 상태로 그려요.
 * 다른 탭을 누르면 고른 표시와 안내를 바꾸고 onSelect를 불러요. 고른 탭을 다시 누르면 아무것도 하지 않아요.
 */
export function renderSampleTabs(
  tabs: HTMLElement,
  hint: HTMLElement,
  samples: readonly Sample[],
  onSelect: (sample: Sample) => void,
): void {
  const doc = tabs.ownerDocument;
  const buttons: HTMLButtonElement[] = [];
  let selected = 0;

  const select = (index: number) => {
    selected = index;
    for (let i = 0; i < buttons.length; i++) buttons[i].setAttribute('aria-selected', String(i === index));
    hint.textContent = samples[index].hint;
  };

  tabs.replaceChildren();
  for (let i = 0; i < samples.length; i++) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'sample-tab';
    button.setAttribute('role', 'tab');
    button.dataset.sample = samples[i].id;
    button.textContent = samples[i].label;
    button.addEventListener('click', () => {
      if (i === selected) return;
      select(i);
      onSelect(samples[i]);
    });
    buttons.push(button);
    tabs.append(button);
  }
  if (samples.length > 0) select(0);
}
