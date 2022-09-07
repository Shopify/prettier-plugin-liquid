import {
  Plugin,
  RequiredOptions,
  SupportLanguage,
  SupportOptions,
} from 'prettier';
import { parsers, liquidHtmlLanguageName } from '~/parser';
import { printers } from '~/printer';
import { LiquidHtmlNode } from '~/types';

const languages: SupportLanguage[] = [
  {
    name: 'LiquidHTML',
    parsers: [liquidHtmlLanguageName],
    extensions: ['.liquid'],
    vscodeLanguageIds: ['liquid', 'Liquid'],
  },
];

const options: SupportOptions = {
  liquidSingleQuote: {
    type: 'boolean',
    category: 'LIQUID',
    default: true,
    description:
      'Use single quotes instead of double quotes in Liquid tags and objects.',
    since: '0.2.0',
  },
  embeddedSingleQuote: {
    type: 'boolean',
    category: 'LIQUID',
    default: true,
    description:
      'Use single quotes instead of double quotes in embedded languages (JavaScript, CSS, TypeScript inside <script>, <style> or Liquid equivalent).',
    since: 'SINCE_VERSION',
  },
  singleLineLinkTags: {
    type: 'boolean',
    category: 'HTML',
    default: false,
    description: 'Always print link tags on a single line to remove clutter',
    since: '0.1.0',
  },
  indentSchema: {
    type: 'boolean',
    category: 'LIQUID',
    default: false,
    description: 'Indent the contents of the {% schema %} tag',
    since: '0.1.0',
  },
};

const defaultOptions: Partial<RequiredOptions> = {
  printWidth: 120,
};

const plugin: Plugin<LiquidHtmlNode> = {
  languages,
  parsers,
  printers,
  options,
  defaultOptions,
};

export = plugin;
