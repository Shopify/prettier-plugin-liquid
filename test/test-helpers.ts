import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs';
import * as prettier from 'prettier';
import * as plugin from '../src';

export function assertFormattedEqualsFixed(dirname: string, options = {}) {
  const source = readFile(dirname, 'index.liquid');
  const formatted = format(source, options);
  const expected = readFile(dirname, 'fixed.liquid');
  if (expected !== formatted) {
    writeFile(dirname, 'actual.liquid', formatted);
  } else {
    fs.rmSync(path.join(dirname, 'actual.liquid'), { force: true });
  }
  return expect(formatted).to.eql(expected);
}

export function readFile(dirname: string, filename: string) {
  return fs.readFileSync(path.join(dirname, filename), 'utf8');
}

export function writeFile(dirname: string, filename: string, contents: string) {
  return fs.writeFileSync(path.join(dirname, filename), contents, 'utf8');
}

export function format(content: string, options: any) {
  return prettier.format(content, {
    ...options,
    parser: 'liquid-html',
    plugins: [plugin],
  });
}
