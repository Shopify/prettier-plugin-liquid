import * as fs from 'fs';
import * as path from 'path';
import ohm from 'ohm-js';

export const liquidHtmlGrammar = ohm.grammar(
  fs.readFileSync(
    path.join(__dirname, '../../grammar/liquid-html.ohm'),
    'utf8',
  ),
);

// see ../../grammar/liquid-html.ohm for full list
export const BLOCKS = (
  liquidHtmlGrammar.rules as any
).blockName.body.terms.map((x: any) => x.obj) as string[];

// see ../../grammar/liquid-html.ohm for full list
export const VOID_ELEMENTS = (
  liquidHtmlGrammar.rules as any
).voidElementName.body.terms.map(
  (x: any) => x.args[0].obj,
) as string[];
