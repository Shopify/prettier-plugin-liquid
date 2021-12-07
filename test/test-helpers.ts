import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs';
import * as prettier from 'prettier';
import * as plugin from '../src';

export function expectFormatted(dirname: string, filename: string, options = {}) {
  const source = readFile(dirname, filename);
  const formatted = format(source, options);
  return expect(formatted);
}

export function readFile(dirname: string, filename: string) {
  return fs.readFileSync(path.join(dirname, filename), 'utf8');
}

export function format(content: string, options: any) {
  return prettier.format(content, {
    ...options,
    parser: "liquid-html",
    plugins: [plugin],
  });
}
