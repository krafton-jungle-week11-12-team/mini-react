// 모듈을 묶는 곳 (docs/design/page.md "모듈을 묶는 곳")
// 엔진 모듈을 import하는 곳은 여기 하나예요. 모듈을 다른 구현으로 바꿀 때는 여기만 고쳐요

import './style.css';
import { toVNode } from './vdom';
import { diff } from './diff';
import { patch } from './patch';
import { fromDiffResult, captureBefore, showChanges } from './change-highlight';
import { createHistory } from './history';
import { createPage, getElements, SAMPLE_HTML } from './page';

/** 강조 표시 모양 (style.md "강조 표시 모양"): 옅은 보라 배경 띠를 잠깐 보여 주고 사라지게 해요. 속성은 바꾸지 않아요 (FR-W27). */
function highlight(el: Element): void {
  if (typeof el.animate !== 'function') return;
  const on = { backgroundColor: '#EDE7FF', boxShadow: '0 0 0 4px #EDE7FF' };
  const off = { backgroundColor: 'rgba(237, 231, 255, 0)', boxShadow: '0 0 0 4px rgba(237, 231, 255, 0)' };
  el.animate([{ ...on, offset: 0 }, { ...on, offset: 0.7 }, { ...off, offset: 1 }], { duration: 2400, easing: 'ease-out' });
}

createPage(
  getElements(document),
  SAMPLE_HTML,
  { toVNode, diff, patch, fromDiffResult, captureBefore, showChanges, createHistory },
  { highlight },
);
