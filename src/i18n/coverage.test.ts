import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hi } from './hi';
import { hiExtra } from './hiExtra';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

describe('Hindi coverage', () => {
  it('has a Hindi string for every literal t() key in the UI', () => {
    const missing = new Set<string>();
    for (const file of sourceFiles('src')) {
      for (const [, raw] of readFileSync(file, 'utf8').matchAll(/\bt\('((?:[^'\\]|\\.)*)'\)/g)) {
        const key = raw.replace(/\\'/g, "'");
        const isMessageKey = /^[\w]+(?:\.[\w]+)+$/.test(key); // dotted keys live in en.ts/hi.ts
        if (!isMessageKey && !(key in hiExtra)) missing.add(`${file}: ${key}`);
        if (isMessageKey && !(key in hi)) missing.add(`${file}: ${key}`);
      }
    }
    expect([...missing]).toEqual([]);
  });
  it('keeps {placeholders} identical between English keys and Hindi values', () => {
    for (const [en, translated] of Object.entries(hiExtra)) {
      expect((translated.match(/\{\w+\}/g) || []).sort()).toEqual((en.match(/\{\w+\}/g) || []).sort());
    }
  });
});
