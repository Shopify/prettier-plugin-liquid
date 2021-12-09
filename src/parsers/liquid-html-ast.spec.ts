import { expect } from 'chai';
import { toLiquidHtmlAST, LiquidHtmlNode } from './liquid-html-ast';
import * as R from 'ramda';

describe('Unit: toLiquidHtmlAST', () => {
  it('should transform a basic Liquid Drop into a LiquidDrop', () => {
    const ast = toLiquidHtmlAST('{{ name }}');
    expectPath(ast, 'children.0').to.exist;
    expectPath(ast, 'children.0.type').to.eql('LiquidDrop');
    expectPath(ast, 'children.0.markup').to.eql(' name ');
    expectPosition(ast, 'children.0');
  });

  it('should transform a basic Liquid Tag into a LiquidTag', () => {
    const ast = toLiquidHtmlAST('{% name %}{% if -%}{%- endif %}');
    expectPath(ast, 'children.0').to.exist;
    expectPath(ast, 'children.0.type').to.eql('LiquidTag');
    expectPath(ast, 'children.0.name').to.eql('name');
    expectPath(ast, 'children.0.markup').to.eql('');
    expectPath(ast, 'children.0.children').to.be.undefined;
    expectPath(ast, 'children.1.whitespaceStart').to.eql('');
    expectPath(ast, 'children.1.whitespaceEnd').to.eql('-');
    expectPath(ast, 'children.1.delimiterWhitespaceStart').to.eql('-');
    expectPath(ast, 'children.1.delimiterWhitespaceEnd').to.eql('');
    expectPosition(ast, 'children.0');
  });

  it('should parse a basic text node into a TextNode', () => {
    const ast = toLiquidHtmlAST('Hello world!');
    expectPath(ast, 'children.0').to.exist;
    expectPath(ast, 'children.0.type').to.eql('TextNode');
    expectPath(ast, 'children.0.value').to.eql('Hello world!');
    expectPosition(ast, 'children.0');
  });

  it('should parse HTML attributes', () => {
    const ast = toLiquidHtmlAST(`<img src="https://1234" loading='lazy' disabled>`);
    expectPath(ast, 'children.0').to.exist;
    expectPath(ast, 'children.0.type').to.eql('HtmlVoidElement');
    expectPath(ast, 'children.0.name').to.eql('img');
    expectPath(ast, 'children.0.attributes.0.name').to.eql('src');
    expectPath(ast, 'children.0.attributes.0.value.0.type').to.eql('TextNode');
    expectPath(ast, 'children.0.attributes.0.value.0.value').to.eql('https://1234');
    expectPath(ast, 'children.0.attributes.1.name').to.eql('loading');
    expectPath(ast, 'children.0.attributes.1.value.0.type').to.eql('TextNode');
    expectPath(ast, 'children.0.attributes.1.value.0.value').to.eql('lazy');
    expectPath(ast, 'children.0.attributes.2.name').to.eql('disabled');

    expectPosition(ast, 'children.0');
    expectPosition(ast, 'children.0.attributes.0');
    expectPosition(ast, 'children.0.attributes.0.value.0');
    expectPosition(ast, 'children.0.attributes.1');
    expectPosition(ast, 'children.0.attributes.1.value.0');
    expectPosition(ast, 'children.0.attributes.2');
  });

  it('should parse script tags as raw', () => {
    const ast = toLiquidHtmlAST(`<script>\n  const a = {{ product | json }};\n</script>`);
    expectPath(ast, 'children.0.type').to.eql('HtmlRawNode');
    expectPath(ast, 'children.0.name').to.eql('script');
    expectPath(ast, 'children.0.body').to.eql('\n  const a = {{ product | json }};\n');
    expectPosition(ast, 'children.0')
  });

  it('should parse style tags as raw', () => {
    const ast = toLiquidHtmlAST(`<style>\n  :root { --bg: {{ settings.bg }}}\n</style>`);
    expectPath(ast, 'children.0.type').to.eql('HtmlRawNode');
    expectPath(ast, 'children.0.name').to.eql('style');
    expectPath(ast, 'children.0.body').to.eql('\n  :root { --bg: {{ settings.bg }}}\n');
    expectPosition(ast, 'children.0')
  })

  it('should parse liquid ifs', () => {
    const ast = toLiquidHtmlAST(`{% if A %}A{% elsif B %}B{% else %}C{% endif %}`);
    expectPath(ast, 'children.0').to.exist;
  });

  function expectPath(ast: LiquidHtmlNode, path: string) {
    return expect(R.path(path.split('.'), ast));
  }

  function expectPosition(ast: LiquidHtmlNode, path: string) {
    expectPath(ast, path + '.position.start').to.be.a('number');
    expectPath(ast, path + '.position.end').to.be.a('number');
  }
});
