import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const BUILD_TIME = `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`;

/**
 * ビルド時刻を書いた build.json を成果物に置く。
 * 画面側がこれを取りに行って、掴んでいるビルドが古いかを判断する。
 */
function buildStamp(): Plugin {
  return {
    name: 'build-stamp',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'build.json',
        source: JSON.stringify({ builtAt: BUILD_TIME }),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), buildStamp()],
  base: './',
  define: {
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
});
