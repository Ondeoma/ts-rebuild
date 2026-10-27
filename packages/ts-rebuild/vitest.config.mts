import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  define: {
    __PROJECT_ROOT__: JSON.stringify(resolve(import.meta.dirname, "..", "..")),
  },
});