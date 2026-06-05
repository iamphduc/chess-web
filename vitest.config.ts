import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: [
      { find: /^.*\.svg$/, replacement: path.resolve(__dirname, 'src/__mocks__/svgMock.ts') },
      { find: /^game\//, replacement: path.resolve(__dirname, 'src/game') + '/' },
      { find: /^features\//, replacement: path.resolve(__dirname, 'src/features') + '/' },
      { find: /^app\//, replacement: path.resolve(__dirname, 'src/app') + '/' },
    ],
  },
  test: {
    environment: 'node',
  },
});
