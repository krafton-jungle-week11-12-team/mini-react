// 모듈을 묶는 곳 (docs/design/phase1/page.md "모듈을 묶는 곳")
// 엔진 모듈을 import하는 곳은 여기 하나예요. 모듈을 다른 구현으로 바꿀 때는 여기만 고쳐요

import './style.css';
import { toVNode, toDOM } from '../modules/vdom';
import { diff } from '../modules/diff';
import { patch } from '../modules/patch';
import { fromDiffResult, captureBefore, showChanges } from './change-highlight';
import { createHistory } from '../modules/history';
import { createPage, getElements } from './page';
import { renderSampleTabs, SAMPLES, type Sample } from './samples';
import { TEST_DONE_HINT, TEST_STEPS, loadTestMode, nextStep, saveTestMode } from './test-mode';

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
const testToggle = document.getElementById('test-mode') as HTMLInputElement | null;
const el = getElements(document);
let selectedSample: Sample = SAMPLES[0];

if (tabs && hint) {
  renderSampleTabs(tabs, hint, SAMPLES, (sample) => {
    selectedSample = sample;
    // 테스트 모드 중에 샘플을 고르면 테스트 모드를 끄고 그 샘플로 돌아가요
    if (testToggle?.checked) {
      testToggle.checked = false;
      saveTestMode(false);
    }
    page.loadSample(sample.html, `샘플 "${sample.label}"로 로드`);
  });
}

// ── 시연용 테스트 모드 ─────────────────────────────────────
// 체크하면 0단계로 로드하고, Patch·기록 이동 뒤마다 다음 단계 HTML 코드를 입력창에 채워요

/** 지금 기록의 다음 단계를 입력창에 넣고 안내를 바꿔요. 테스트 모드가 꺼져 있으면 아무것도 하지 않아요. */
function fillNextStep(): void {
  if (!testToggle?.checked) return;
  const next = nextStep(page.history.current().html);
  if (next !== null) {
    el.testCode.value = next.html;
    page.onInput(); // 줄 번호와 Patch 버튼 상태를 맞춰요
  }
  if (hint) hint.textContent = next?.hint ?? TEST_DONE_HINT;
}

function startTestMode(): void {
  page.loadSample(TEST_STEPS[0].html, '테스트 모드로 로드');
  fillNextStep();
}

if (testToggle) {
  testToggle.checked = loadTestMode();
  testToggle.addEventListener('change', () => {
    saveTestMode(testToggle.checked);
    if (testToggle.checked) {
      startTestMode();
    } else {
      page.loadSample(selectedSample.html, `샘플 "${selectedSample.label}"로 로드`);
      if (hint) hint.textContent = selectedSample.hint;
    }
  });
  // createPage가 먼저 연결한 핸들러가 Patch·이동을 끝낸 뒤 다음 단계를 채워요
  el.patchButton.addEventListener('click', fillNextStep);
  el.backButton.addEventListener('click', fillNextStep);
  el.forwardButton.addEventListener('click', fillNextStep);
  if (testToggle.checked) startTestMode();
}
