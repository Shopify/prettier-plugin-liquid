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

/**
 * Lets you write "magic" string literals that are "reindented" similar to Ruby's <<~
 * So you can write
 *
 * const input = reindent`
 *   function() {
 *     foo();
 *   }
 * `;
 *
 * And it will be as though function() was at indent 0 and foo was indent 1.
 */
export function reindent(strs: TemplateStringsArray, ...keys: any[]): string {
  const s = strs.reduce((acc, next, i) => {
    if (keys[i] !== undefined) {
      return acc + next + keys[i];
    }
    return acc + next;
  }, '');
  const lines = s.replace(/^\r?\n|\s+$/g, '').split(/\r?\n/);
  const minIndentLevel = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => (line.match(/^\s*/) as any)[0].length)
    .reduce((a, b) => Math.min(a, b), Infinity);

  if (minIndentLevel === Infinity) {
    return lines.join('\n');
  }

  const indentStrip = ' '.repeat(minIndentLevel);
  return lines
    .map((line) => line.replace(indentStrip, ''))
    .map((s) => s.trimEnd())
    .join('\n');
}
