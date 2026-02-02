import { describe, it, expect, beforeAll } from 'vitest';

import fs from "node:fs"
import path from "node:path"
import { execSync } from 'node:child_process';

const PROJECT_ROOT = process.env.PROJECT_ROOT!;
const EXAMPLE_DIR = path.resolve(PROJECT_ROOT, 'packages/example');
const DIST_FILE = path.resolve(EXAMPLE_DIR, 'dist/index.js');

describe('Integration Test: packages/example', () => {
  // clean up
  beforeAll(() => {
    if (fs.existsSync(DIST_FILE)) {
      fs.rmSync(path.resolve(EXAMPLE_DIR, 'dist'), { recursive: true, force: true });
    }
  });

  it('should compile successfully', () => {
    expect(() => {
      execSync('npm run build:example', { 
        cwd: PROJECT_ROOT, 
        stdio: 'inherit',
      });
    }).not.toThrow();
    expect(fs.existsSync(DIST_FILE)).toBe(true);
  });

  it('should execute the compiled code successfully', () => {
    const output = execSync(`npm run exec:example`, {
      cwd: PROJECT_ROOT, 
      encoding: 'utf-8',
    });
    expect(output).toContain('true');
    expect(output).toContain('false');
  });

  it('should match the generated code snapshot', () => {
    const generatedCode = fs.readFileSync(DIST_FILE, 'utf-8');
    expect(generatedCode).toMatchSnapshot();
  });
});
