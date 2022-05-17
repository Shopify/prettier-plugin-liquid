import { Plugin, SupportOptions } from 'prettier';
import { parsers, liquidHtmlLanguageName } from '~/parser';
import { printers } from '~/printer';
import { LiquidHtmlNode } from '~/types';

const languages = [
  {
    name: 'LiquidHTML',
    parsers: [liquidHtmlLanguageName],
    extensions: ['.liquid'],
    vscodelanguageIds: ['liquid', 'Liquid'],
  },
];

const options: SupportOptions = {
  singleLineLinkTags: {
    type: 'boolean',
    category: 'HTML',
    default: false,
    description: 'Always print link tags on a single line to remove clutter',
    since: '0.0.1',
  },
};
const defaultOptions = {};

const plugin: Plugin<LiquidHtmlNode> = {
  languages,
  parsers,
  printers,
  options,
  defaultOptions,
};

export = plugin;
