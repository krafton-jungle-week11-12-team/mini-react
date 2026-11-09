import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // DOM API(document, Node 등)를 쓰는 테스트라 브라우저 대신 jsdom에서 실행해요
    environment: 'jsdom',
  },
});
