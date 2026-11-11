// 모듈을 묶는 곳 (docs/design/phase1/page.md "모듈을 묶는 곳")
// 엔진 모듈을 import하는 곳은 여기 하나예요. 모듈을 다른 구현으로 바꿀 때는 여기만 고쳐요

import './style.css';
import { toVNode, toDOM } from '../modules/vdom';
import { diff } from '../modules/diff';
import { patch } from '../modules/patch';
import { fromDiffResult, captureBefore, showChanges } from './change-highlight';
import { createHistory } from '../modules/history';
import { createPage, getElements } from './page';
import { renderSampleTabs, SAMPLES } from './samples';
import { SAMPLE_STEPS, STEPS_DONE_HINT, nextStep } from './sample-steps';

/**
 * 강조 표시 모양 (style.md "강조 표시 모양"): 옅은 보라 배경 띠가 나타나 다음 Patch나 기록 이동 전까지 남아요.
 * animate()의 fill: 'forwards'로 마지막 모양을 유지해요. 속성은 바꾸지 않아요 (FR-W27). 지우는 건 createPage가 해요.
 */
function highlight(el: Element): void {
  if (typeof el.animate !== 'function') return;
  const on = { backgroundColor: '#EDE7FF', boxShadow: '-4px 0 0 #EDE7FF, 4px 0 0 #EDE7FF' };
  const off = { backgroundColor: 'rgba(237, 231, 255, 0)', boxShadow: '-4px 0 0 rgba(237, 231, 255, 0), 4px 0 0 rgba(237, 231, 255, 0)' };
  el.animate([off, on], { duration: 400, easing: 'ease-out', fill: 'forwards' });
}

const page = createPage(
  getElements(document),
  SAMPLES[0].html,
  { toVNode, toDOM, diff, patch, fromDiffResult, captureBefore, showChanges, createHistory },
  { highlight },
);

// 샘플 탭 (FR-X05, sample.md). 자리가 없으면 탭 없이 동작해요
const tabs = document.getElementById('sample-tabs');
const hint = document.getElementById('sample-hint');
if (tabs && hint) {
  renderSampleTabs(tabs, hint, SAMPLES, (sample) => page.loadSample(sample.html, `샘플 "${sample.label}"로 로드`));
}

// 시연용 샘플 코드 작성 (sample-steps.ts). 단계에 없는 코드면 0단계로 로드하고, 단계 중이면 다음 단계 HTML 코드를 입력창에 넣어요
const writeButton = document.getElementById('sample-write');
const el = getElements(document);
writeButton?.addEventListener('click', () => {
  const next = nextStep(page.history.current().html);
  if (next === SAMPLE_STEPS[0]) {
    // 단계에 없는 코드면 실제 영역까지 0단계로 새로 로드해요
    page.loadSample(next.html, '샘플 코드 작성으로 0단계 로드');
  } else if (next !== null) {
    el.testCode.value = next.html;
    page.onInput(); // 줄 번호와 Patch 버튼 상태를 맞춰요
  }
  if (hint) hint.textContent = next?.hint ?? STEPS_DONE_HINT;
});
