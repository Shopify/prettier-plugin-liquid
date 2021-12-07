import { expect } from 'chai';
import * as R from 'ramda';
import { LiquidHtmlCST, toLiquidHtmlCST } from './liquid-html-cst';
import { BLOCKS, VOID_ELEMENTS } from './grammar';

describe('Unit: toLiquidHtmlCST(text)', () => {
  describe('Case: HtmlNode', () => {
    it('should basically parse open and close tags', () => {
      ['<div></div>', '<div ></div >'].forEach((text) => {
        const ast = toLiquidHtmlCST(text);
        expectPath(ast, '0.type').to.equal('TagOpen');
        expectPath(ast, '0.name').to.equal('div');
        expectPath(ast, '1.type').to.equal('TagClose');
        expectPath(ast, '1.name').to.equal('div');
        expectLocation(ast, [0]);
        expectLocation(ast, [1]);
      });
    });
  });

  it('should parse void elements', () => {
    VOID_ELEMENTS.forEach((voidElementName) => {
      const ast = toLiquidHtmlCST(`<${voidElementName} disabled>`);
      expectPath(ast, '0.type').to.equal('VoidElement');
      expectPath(ast, '0.name').to.equal(voidElementName);
      expectLocation(ast, [0]);
    });
  });

  it('should parse empty attributes', () => {
    ['<div empty>', '<div empty >', '<div\nempty\n>'].forEach(
      (text) => {
        const ast = toLiquidHtmlCST(text);
        expectPath(ast, '0.attrList.0.type').to.equal('AttrEmpty');
        expectPath(ast, '0.attrList.0.name').to.equal('empty');
        expectPath(ast, '0.name.attrList.0.value').to.be.undefined;
        expectLocation(ast, [0]);
        expectLocation(ast, [0, 'attrList', 0]);
      },
    );
  });

  [
    { type: 'AttrSingleQuoted', name: 'single', quote: "'" },
    { type: 'AttrDoubleQuoted', name: 'double', quote: '"' },
    { type: 'AttrUnquoted', name: 'unquoted', quote: '' },
  ].forEach((testConfig) => {
    it(`should parse ${testConfig.type} attributes`, () => {
      [
        `<div ${testConfig.name}=${testConfig.quote}${testConfig.name}${testConfig.quote}>`,
        `<div ${testConfig.name}=${testConfig.quote}${testConfig.name}${testConfig.quote} >`,
        `<div\n${testConfig.name}=${testConfig.quote}${testConfig.name}${testConfig.quote}\n>`,
      ].forEach((text) => {
        const ast = toLiquidHtmlCST(text);
        expectPath(ast, '0.attrList.0.type').to.equal(
          testConfig.type,
        );
        expectPath(ast, '0.attrList.0.name').to.equal(
          testConfig.name,
        );
        expectPath(ast, '0.attrList.0.value.0.type').to.eql(
          'TextNode',
        );
        expectPath(ast, '0.attrList.0.value.0.value').to.eql(
          testConfig.name,
        );
        expectLocation(ast, [0]);
        expectLocation(ast, [0, 'attrList', 0]);
      });
    });

    it(`should accept liquid nodes inside ${testConfig.type}`, () => {
      [
        `<div ${testConfig.name}=${testConfig.quote}https://{{ name }}${testConfig.quote}>`,
        `<div ${testConfig.name}=${testConfig.quote}https://{{ name }}${testConfig.quote} >`,
        `<div\n${testConfig.name}=${testConfig.quote}https://{{ name }}${testConfig.quote}\n>`,
      ].forEach((text) => {
        const ast = toLiquidHtmlCST(text);
        expectPath(ast, '0.attrList.0.value.1.type').to.eql(
          'LiquidDrop',
          text,
        );
        expectLocation(ast, [0]);
        expectLocation(ast, [0, 'attrList', 0]);
      });
    });
  });

  describe('Case: LiquidNode', () => {
    it('should basically parse liquid drops', () => {
      const ast = toLiquidHtmlCST('{{ name }}{{- names -}}');
      expectPath(ast, '0.type').to.equal('LiquidDrop');
      expectPath(ast, '0.markup').to.equal(' name ');
      expectPath(ast, '0.whitespaceStart').to.equal(null);
      expectPath(ast, '0.whitespaceEnd').to.equal(null);
      expectPath(ast, '1.whitespaceStart').to.equal('-');
      expectPath(ast, '1.whitespaceEnd').to.equal('-');
      expectLocation(ast, [0]);
    });

    it('should basically parse liquid tags', () => {
      const ast = toLiquidHtmlCST(
        '{%   assign x = 1 %}{% if hi -%}{%- endif %}',
      );
      expectPath(ast, '0.type').to.equal('LiquidTag');
      expectPath(ast, '0.name').to.equal('assign');
      expectPath(ast, '0.markup').to.equal('x = 1 ');
      expectPath(ast, '0.whitespaceStart').to.equal(null);
      expectPath(ast, '0.whitespaceEnd').to.equal(null);
      expectPath(ast, '1.type').to.equal('LiquidTagOpen');
      expectPath(ast, '1.name').to.equal('if');
      expectPath(ast, '1.markup').to.equal('hi ');
      expectPath(ast, '1.whitespaceStart').to.equal(null);
      expectPath(ast, '1.whitespaceEnd').to.equal('-');
      expectPath(ast, '2.type').to.equal('LiquidTagClose');
      expectPath(ast, '2.name').to.equal('if');
      expectPath(ast, '2.whitespaceStart').to.equal('-');
      expectPath(ast, '2.whitespaceEnd').to.equal(null);
      expectLocation(ast, [0]);
    });

    it('should parse tag open / close', () => {
      BLOCKS.forEach((block: string) => {
        const ast = toLiquidHtmlCST(
          `{% ${block} args -%}{%- end${block} %}`,
        );
        expectPath(ast, '0.type').to.equal('LiquidTagOpen');
        expectPath(ast, '0.name').to.equal(block);
        expectPath(ast, '0.whitespaceStart').to.equal(null);
        expectPath(ast, '0.whitespaceEnd').to.equal('-');
        expectPath(ast, '0.markup').to.equal('args ');
        expectPath(ast, '1.type').to.equal('LiquidTagClose');
        expectPath(ast, '1.name').to.equal(block);
        expectPath(ast, '1.whitespaceStart').to.equal('-');
        expectPath(ast, '1.whitespaceEnd').to.equal(null);
      });
    });
  });

  describe('Case: TextNode', () => {
    it('should parse text nodes', () => {
      [
        '<div>hello</div>',
        '{% if condition %}hello{% endif %}',
      ].forEach((text) => {
        const ast = toLiquidHtmlCST(text);
        expectPath(ast, '1.type').to.equal('TextNode');
        expectPath(ast, '1.value').to.equal('hello');
        expectLocation(ast, [1]);
      });
    });
  });

  function expectLocation(
    ast: LiquidHtmlCST,
    path: (string | number)[],
  ) {
    expect(R.path(path.concat('locStart'), ast)).to.be.a('number');
    expect(R.path(path.concat('locEnd'), ast)).to.be.a('number');
  }

  function expectPath(ast: LiquidHtmlCST, path: string) {
    return expect(R.path(path.split('.'), ast));
  }
});
