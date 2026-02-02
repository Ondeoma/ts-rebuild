import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    env: {
      PROJECT_ROOT: resolve(__dirname),
    }
  }
});