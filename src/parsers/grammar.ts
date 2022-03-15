import ohm from 'ohm-js';

export const liquidHtmlGrammar = ohm.grammar(
  require('../../grammar/liquid-html.ohm.js'),
);

// see ../../grammar/liquid-html.ohm for full list
export const BLOCKS = (liquidHtmlGrammar.rules as any).blockName.body.terms.map(
  (x: any) => x.obj,
) as string[];

// see ../../grammar/liquid-html.ohm for full list
export const VOID_ELEMENTS = (
  liquidHtmlGrammar.rules as any
).voidElementName.body.terms.map((x: any) => x.args[0].obj) as string[];
