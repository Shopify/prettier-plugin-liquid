import * as fs from 'fs';
import * as path from 'path';
import ohm from 'ohm-js';

export const BLOCKS = [
  'capture',
  'case',
  'comment',
  'for',
  'if',
  'ifchanged',
  'raw',
  'tablerow',
]

export const liquidHtmlGrammar = ohm.grammar(
  fs.readFileSync(
    path.join(__dirname, '../../grammar/liquid-html.ohm'),
    'utf8',
  ),
);
