import ohm from 'ohm-js';

export const liquidHtmlGrammars = ohm.grammars(
  require('../../grammar/liquid-html.ohm.js'),
);

export const liquidHtmlGrammar = liquidHtmlGrammars['LiquidHTML'];

// see ../../grammar/liquid-html.ohm for full list
export const BLOCKS = (
  liquidHtmlGrammar.rules as any
).blockName.body.factors[0].terms.map((x: any) => x.obj) as string[];

// see ../../grammar/liquid-html.ohm for full list
export const VOID_ELEMENTS = (
  liquidHtmlGrammar.rules as any
).voidElementName.body.factors[0].terms.map(
  (x: any) => x.args[0].obj,
) as string[];

export const TAGS_WITHOUT_MARKUP = [
  'style',
  'schema',
  'javascript',
  'else',
  'break',
  'continue',
  'comment',
  'raw',
];
