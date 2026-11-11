import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages는 /mini-react/ 아래에서 서비스해요. 상대 경로로 빌드해야 assets를 찾아요
  base: './',
  build: {
    rollupOptions: {
      // 페이지 세 개를 함께 빌드해요
      // - index.html: 첫 화면 (Phase 1, Phase 2 링크)
      // - phase1.html: Phase 1 검증 페이지 (src/phase1/page/main.ts)
      // - phase2.html: Phase 2 할 일 앱 (src/phase2/page/main.ts)
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        phase1: resolve(import.meta.dirname, 'phase1.html'),
        phase2: resolve(import.meta.dirname, 'phase2.html'),
      },
    },
  },
});
