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
  try {
    return expect(formatted).to.eql(expected);
  } catch (e) {
    // Improve the stack trace so that it points to the fixed file instead
    // of this test-helper file. Might make navigation smoother.
    if ((e as any).stack as any) {
      (e as any).stack = ((e as any).stack as string).replace(
        /^(\s+)at assertFormattedEqualsFixed \(.*:\d+:\d+\)/im,
        [
          `$1at expected.liquid (${path.join(
            dirname,
            'fixed.liquid',
          )}:${diffLoc(expected, formatted).join(':')})`,
          `$1at actual.liquid (${path.join(dirname, 'actual.liquid')}:${diffLoc(
            formatted,
            expected,
          ).join(':')})`,
          `$1at input.liquid (${path.join(dirname, 'index.liquid')}:1:1)`,
        ].join('\n'),
      );
    }

    throw e;
  }
}

function diffLoc(expected: string, actual: string) {
  // assumes there's a diff.
  let line = 1;
  let col = 0;
  for (let i = 0; i < expected.length; i++) {
    if (expected[i] === '\n') {
      line += 1;
      col = 0;
    }
    col += 1;
    if (expected[i] !== actual[i]) break;
  }
  return [line, col];
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
