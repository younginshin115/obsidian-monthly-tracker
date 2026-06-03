import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      // The real `obsidian` module only exists inside Obsidian, so point tests
      // at a lightweight mock implementing the bits our helpers use.
      obsidian: resolve(__dirname, 'test/obsidian-mock.ts'),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
  },
});
