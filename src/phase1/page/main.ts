// 모듈을 묶는 곳 (docs/design/phase1/page.md "모듈을 묶는 곳")
// 엔진 모듈을 import하는 곳은 여기 하나예요. 모듈을 다른 구현으로 바꿀 때는 여기만 고쳐요

import './style.css';
import { toVNode, toDOM } from '../modules/vdom';
import { diff } from '../modules/diff';
import { patch } from '../modules/patch';
import { fromDiffResult, captureBefore, showChanges } from './change-highlight';
import { createHistory } from '../modules/history';
import { createPage, getElements, SAMPLE_HTML } from './page';

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

createPage(
  getElements(document),
  SAMPLE_HTML,
  { toVNode, toDOM, diff, patch, fromDiffResult, captureBefore, showChanges, createHistory },
  { highlight },
);
