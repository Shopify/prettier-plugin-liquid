import { expect } from 'chai';
import { LiquidHtmlCST, toLiquidHtmlCST } from '~/parser/cst';
import { BLOCKS, VOID_ELEMENTS } from '~/parser/grammar';
import { deepGet } from '~/utils';

describe('Unit: toLiquidHtmlCST(text)', () => {
  let cst: LiquidHtmlCST;

  describe('Case: HtmlComment', () => {
    it('should basically parse html comments', () => {
      ['<!-- hello world -->'].forEach((text) => {
        cst = toLiquidHtmlCST(text);
        expectPath(cst, '0.type').to.equal('HtmlComment');
        expectPath(cst, '0.body').to.equal('hello world');
        expectLocation(cst, '0');
      });
    });
  });

  describe('Case: HtmlNode', () => {
    it('should basically parse open and close tags', () => {
      ['<div></div>', '<div ></div >'].forEach((text) => {
        cst = toLiquidHtmlCST(text);
        expectPath(cst, '0.type').to.equal('HtmlTagOpen');
        expectPath(cst, '0.name').to.equal('div');
        expectPath(cst, '1.type').to.equal('HtmlTagClose');
        expectPath(cst, '1.name').to.equal('div');
        expectLocation(cst, '0');
        expectLocation(cst, '1');
      });
    });

    it('should parse liquid drop tag names', () => {
      cst = toLiquidHtmlCST('<{{ node_type }}></{{ node_type }}>');
      expectPath(cst, '0.type').to.equal('HtmlTagOpen');
      expectPath(cst, '0.name.type').to.equal('LiquidDrop');
      expectPath(cst, '0.name.markup.type').to.equal('LiquidVariable');
      expectPath(cst, '0.name.markup.expression.type').to.equal('VariableLookup');
      expectPath(cst, '0.name.markup.expression.name').to.equal('node_type');
      expectPath(cst, '1.type').to.equal('HtmlTagClose');
      expectPath(cst, '1.name.type').to.equal('LiquidDrop');
      expectPath(cst, '1.name.markup.type').to.equal('LiquidVariable');
      expectPath(cst, '1.name.markup.expression.type').to.equal('VariableLookup');
      expectPath(cst, '1.name.markup.expression.name').to.equal('node_type');
      expectLocation(cst, '0');
      expectLocation(cst, '0.name');
      expectLocation(cst, '1');
      expectLocation(cst, '1.name');
    });

    it('should parse script and style tags as a dump', () => {
      cst = toLiquidHtmlCST(
        '<script>\nconst a = {{ product | json }}\n</script><style>\n#id {}\n</style>',
      );
      expectPath(cst, '0.type').to.eql('HtmlRawTag');
      expectPath(cst, '0.name').to.eql('script');
      expectPath(cst, '0.body').to.eql('\nconst a = {{ product | json }}\n');
      expectPath(cst, '1.type').to.eql('HtmlRawTag');
      expectPath(cst, '1.name').to.eql('style');
      expectPath(cst, '1.body').to.eql('\n#id {}\n');
      expectLocation(cst, '0');
    });

    it('should properly return block{Start,End}Loc{Start,End} locations of raw tags', () => {
      const source = '<script>const a = {{ product | json }}</script>';
      cst = toLiquidHtmlCST(source);
      expectPath(cst, '0.type').to.equal('HtmlRawTag');
      expectPath(cst, '0.blockStartLocStart').to.equal(0);
      expectPath(cst, '0.blockStartLocEnd').to.equal(source.indexOf('const'));
      expectPath(cst, '0.blockEndLocStart').to.equal(source.indexOf('</script>'));
      expectPath(cst, '0.blockEndLocEnd').to.equal(source.length);
      expectLocation(cst, '0');
    });

    it('should parse void elements', () => {
      VOID_ELEMENTS.forEach((voidElementName: any) => {
        cst = toLiquidHtmlCST(`<${voidElementName} disabled>`);
        expectPath(cst, '0.type').to.equal('HtmlVoidElement');
        expectPath(cst, '0.name').to.equal(voidElementName);
        expectPath(cst, '0.attrList.0.name').to.equal('disabled');
        expectLocation(cst, '0');
      });
    });

    it('should parse empty attributes', () => {
      ['<div empty>', '<div empty >', '<div\nempty\n>'].forEach((text) => {
        cst = toLiquidHtmlCST(text);
        expectPath(cst, '0.attrList.0.type').to.equal('AttrEmpty');
        expectPath(cst, '0.attrList.0.name').to.equal('empty');
        expectPath(cst, '0.name.attrList.0.value').to.be.undefined;
        expectLocation(cst, '0');
        expectLocation(cst, '0.attrList.0');
      });
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
          cst = toLiquidHtmlCST(text);
          expectPath(cst, '0.attrList.0.type').to.equal(testConfig.type);
          expectPath(cst, '0.attrList.0.name').to.equal(testConfig.name);
          expectPath(cst, '0.attrList.0.value.0.type').to.eql('TextNode');
          expectPath(cst, '0.attrList.0.value.0.value').to.eql(testConfig.name);
          expectLocation(cst, '0');
          expectLocation(cst, '0.attrList.0');
        });
      });

      if (testConfig.name != 'unquoted') {
        it(`should accept liquid nodes inside ${testConfig.type}`, () => {
          [
            `<div ${testConfig.name}=${testConfig.quote}https://{{ name }}${testConfig.quote}>`,
            `<div ${testConfig.name}=${testConfig.quote}https://{{ name }}${testConfig.quote} >`,
            `<div\n${testConfig.name}=${testConfig.quote}https://{{ name }}${testConfig.quote}\n>`,
          ].forEach((text) => {
            cst = toLiquidHtmlCST(text);
            expectPath(cst, '0.attrList.0.value.1.type').to.eql('LiquidDrop', text);
            expectLocation(cst, '0');
            expectLocation(cst, '0.attrList.0');
          });
        });
      }

      it(`should accept top level liquid nodes that contain ${testConfig.type}`, () => {
        [
          `<div {% if A %}${testConfig.name}=${testConfig.quote}https://name${testConfig.quote}{% endif %}>`,
          `<div {% if A %} ${testConfig.name}=${testConfig.quote}https://name${testConfig.quote} {% endif %}>`,
          `<div\n{% if A %}\n${testConfig.name}=${testConfig.quote}https://name${testConfig.quote}\n{% endif %}>`,
        ].forEach((text) => {
          cst = toLiquidHtmlCST(text);
          expectPath(cst, '0.attrList.0.type').to.eql('LiquidTagOpen', text);
          expectPath(cst, '0.attrList.1.type').to.eql(testConfig.type, text);
          expectPath(cst, '0.attrList.1.value.0.value').to.eql('https://name');
          expectPath(cst, '0.attrList.2.type').to.eql('LiquidTagClose', text);
          expectLocation(cst, '0');
          expectLocation(cst, '0.attrList.0');
        });
      });
    });
  });

  describe('Case: LiquidDrop', () => {
    it('should basically parse unparseables', () => {
      cst = toLiquidHtmlCST('{{ !-asdl }}{{- !-asdl -}}');
      expectPath(cst, '0.type').to.equal('LiquidDrop');
      expectPath(cst, '0.markup').to.equal('!-asdl');
      expectPath(cst, '0.whitespaceStart').to.equal(null);
      expectPath(cst, '0.whitespaceEnd').to.equal(null);
      expectPath(cst, '1.type').to.equal('LiquidDrop');
      expectPath(cst, '1.markup').to.equal('!-asdl');
      expectPath(cst, '1.whitespaceStart').to.equal('-');
      expectPath(cst, '1.whitespaceEnd').to.equal('-');
      expectLocation(cst, '0');
    });

    it('should parse strings', () => {
      [
        { expression: `"string o' string"`, value: `string o' string`, single: false },
        { expression: `'He said: "hi!"'`, value: `He said: "hi!"`, single: true },
      ].forEach(({ expression, value, single }) => {
        cst = toLiquidHtmlCST(`{{ ${expression} }}`);
        expectPath(cst, '0.type').to.equal('LiquidDrop');
        expectPath(cst, '0.markup.type').to.equal('LiquidVariable');
        expectPath(cst, '0.markup.rawSource').to.equal(expression);
        expectPath(cst, '0.markup.expression.type').to.equal('String');
        expectPath(cst, '0.markup.expression.value').to.equal(value);
        expectPath(cst, '0.markup.expression.single').to.equal(single);
        expectPath(cst, '0.whitespaceStart').to.equal(null);
        expectPath(cst, '0.whitespaceEnd').to.equal(null);
        expectLocation(cst, '0');
        expectLocation(cst, '0.markup');
        expectLocation(cst, '0.markup.expression');
      });
    });

    it('should parse numbers', () => {
      [
        { expression: `1`, value: '1' },
        { expression: `1.02`, value: '1.02' },
        { expression: `0`, value: '0' },
        { expression: `-0`, value: '-0' },
        { expression: `-0.0`, value: '-0.0' },
      ].forEach(({ expression, value }) => {
        cst = toLiquidHtmlCST(`{{ ${expression} }}`);
        expectPath(cst, '0.type').to.equal('LiquidDrop');
        expectPath(cst, '0.markup.type').to.equal('LiquidVariable');
        expectPath(cst, '0.markup.rawSource').to.equal(expression);
        expectPath(cst, '0.markup.expression.type').to.equal('Number');
        expectPath(cst, '0.markup.expression.value').to.equal(value);
        expectPath(cst, '0.whitespaceStart').to.equal(null);
        expectPath(cst, '0.whitespaceEnd').to.equal(null);
        expectLocation(cst, '0');
        expectLocation(cst, '0.markup');
        expectLocation(cst, '0.markup.expression');
      });
    });

    it('should parse Liquid literals', () => {
      [
        { expression: `nil`, value: null },
        { expression: `null`, value: null },
        { expression: `true`, value: true },
        { expression: `blank`, value: '' },
        { expression: `empty`, value: '' },
      ].forEach(({ expression, value }) => {
        cst = toLiquidHtmlCST(`{{ ${expression} }}`);
        expectPath(cst, '0.type').to.equal('LiquidDrop');
        expectPath(cst, '0.markup.type').to.equal('LiquidVariable', expression);
        expectPath(cst, '0.markup.rawSource').to.equal(expression);
        expectPath(cst, '0.markup.expression.type').to.equal('LiquidLiteral');
        expectPath(cst, '0.markup.expression.keyword').to.equal(expression);
        expectPath(cst, '0.markup.expression.value').to.equal(value);
        expectPath(cst, '0.whitespaceStart').to.equal(null);
        expectPath(cst, '0.whitespaceEnd').to.equal(null);
        expectLocation(cst, '0');
        expectLocation(cst, '0.markup');
        expectLocation(cst, '0.markup.expression');
      });
    });

    interface Lookup {
      type: 'VariableLookup';
      lookups: (string | number | Lookup)[];
      name: string | undefined;
    }

    it('should parse variable lookups', () => {
      const v = (name: string, lookups: (string | number | Lookup)[] = []): Lookup => ({
        type: 'VariableLookup',
        name,
        lookups,
      });
      [
        { expression: `x`, name: 'x', lookups: [] },
        { expression: `x.y`, name: 'x', lookups: ['y'] },
        { expression: `x["y"]`, name: 'x', lookups: ['y'] },
        { expression: `x['y']`, name: 'x', lookups: ['y'] },
        { expression: `x[1]`, name: 'x', lookups: [1] },
        { expression: `x.y.z`, name: 'x', lookups: ['y', 'z'] },
        { expression: `x["y"]["z"]`, name: 'x', lookups: ['y', 'z'] },
        { expression: `x["y"].z`, name: 'x', lookups: ['y', 'z'] },
        { expression: `["product"]`, name: null, lookups: ['product'] },
        { expression: `page.about-us`, name: 'page', lookups: ['about-us'] },
        { expression: `["x"].y`, name: null, lookups: ['x', 'y'] },
        { expression: `["x"]["y"]`, name: null, lookups: ['x', 'y'] },
        { expression: `x[y]`, name: 'x', lookups: [v('y')] },
        { expression: `x[y.z]`, name: 'x', lookups: [v('y', ['z'])] },
        { expression: `true_thing`, name: 'true_thing', lookups: [] },
        { expression: `null_thing`, name: 'null_thing', lookups: [] },
      ].forEach(({ expression, name, lookups }) => {
        cst = toLiquidHtmlCST(`{{ ${expression} }}`);
        expectPath(cst, '0.type').to.equal('LiquidDrop');
        expectPath(cst, '0.markup.type').to.equal('LiquidVariable', expression);
        expectPath(cst, '0.markup.rawSource').to.equal(expression);
        expectPath(cst, '0.markup.expression.type').to.equal('VariableLookup');
        expectPath(cst, '0.markup.expression.name').to.equal(name, expression);
        expectPath(cst, '0.markup.expression.lookups').to.be.an('array');

        lookups.forEach((lookup: string | number | Lookup, i: number) => {
          switch (typeof lookup) {
            case 'string': {
              expectPath(cst, `0.markup.expression.lookups.${i}.type`).to.equal('String');
              expectPath(cst, `0.markup.expression.lookups.${i}.value`).to.equal(lookup);
              break;
            }
            case 'number': {
              expectPath(cst, `0.markup.expression.lookups.${i}.type`).to.equal('Number');
              expectPath(cst, `0.markup.expression.lookups.${i}.value`).to.equal(lookup.toString());
              break;
            }
            default: {
              expectPath(cst, `0.markup.expression.lookups.${i}.type`).to.equal('VariableLookup');
              expectPath(cst, `0.markup.expression.lookups.${i}.name`).to.equal(lookup.name);
              lookup.lookups.forEach((val, j) => {
                // Being lazy here... Assuming string properties.
                expectPath(cst, `0.markup.expression.lookups.${i}.lookups.${j}.type`).to.equal(
                  'String',
                );
                expectPath(cst, `0.markup.expression.lookups.${i}.lookups.${j}.value`).to.equal(
                  val,
                );
              });
              expectLocation(cst, `0.markup.expression.lookups.${i}`);
              break;
            }
          }
        });

        expectPath(cst, '0.whitespaceStart').to.equal(null);
        expectPath(cst, '0.whitespaceEnd').to.equal(null);
        expectLocation(cst, '0');
        expectLocation(cst, '0.markup');
        expectLocation(cst, '0.markup.expression');
      });
    });

    it('should parse ranges', () => {
      [
        {
          expression: `(0..5)`,
          start: { value: '0', type: 'Number' },
          end: { value: '5', type: 'Number' },
        },
        {
          expression: `( 0 .. 5 )`,
          start: { value: '0', type: 'Number' },
          end: { value: '5', type: 'Number' },
        },
        {
          expression: `(true..false)`,
          start: { value: true, type: 'LiquidLiteral' },
          end: { value: false, type: 'LiquidLiteral' },
        },
      ].forEach(({ expression, start, end }) => {
        cst = toLiquidHtmlCST(`{{ ${expression} }}`);
        expectPath(cst, '0.type').to.equal('LiquidDrop');
        expectPath(cst, '0.markup.type').to.equal('LiquidVariable', expression);
        expectPath(cst, '0.markup.rawSource').to.equal(expression);
        expectPath(cst, '0.markup.expression.type').to.equal('Range');
        expectPath(cst, '0.markup.expression.start.type').to.equal(start.type);
        expectPath(cst, '0.markup.expression.start.value').to.equal(start.value);
        expectPath(cst, '0.markup.expression.end.type').to.equal(end.type);
        expectPath(cst, '0.markup.expression.end.value').to.equal(end.value);
        expectPath(cst, '0.whitespaceStart').to.equal(null);
        expectPath(cst, '0.whitespaceEnd').to.equal(null);
        expectLocation(cst, '0');
        expectLocation(cst, '0.markup');
        expectLocation(cst, '0.markup.expression');
        expectLocation(cst, '0.markup.expression.start');
        expectLocation(cst, '0.markup.expression.end');
      });
    });
  });

  describe('Case: LiquidNode', () => {
    it('should parse raw tags', () => {
      ['style', 'raw'].forEach((raw) => {
        cst = toLiquidHtmlCST(`{% ${raw} -%}<div>{%- end${raw} %}`);
        expectPath(cst, '0.type').to.equal('LiquidRawTag');
        expectPath(cst, '0.body').to.equal('<div>');
        expectPath(cst, '0.whitespaceStart').to.equal(null);
        expectPath(cst, '0.whitespaceEnd').to.equal('-');
        expectPath(cst, '0.delimiterWhitespaceStart').to.equal('-');
        expectPath(cst, '0.delimiterWhitespaceEnd').to.equal(null);
        expectLocation(cst, '0');
      });
    });

    it('should properly return block{Start,End}Loc{Start,End} locations of raw tags', () => {
      const source = '{% raw -%}<div>{%- endraw %}';
      cst = toLiquidHtmlCST(source);
      expectPath(cst, '0.type').to.equal('LiquidRawTag');
      expectPath(cst, '0.body').to.equal('<div>');
      expectPath(cst, '0.blockStartLocStart').to.equal(0);
      expectPath(cst, '0.blockStartLocEnd').to.equal(source.indexOf('<'));
      expectPath(cst, '0.blockEndLocStart').to.equal(source.indexOf('>') + 1);
      expectPath(cst, '0.blockEndLocEnd').to.equal(source.length);
      expectPath(cst, '0.delimiterWhitespaceStart').to.equal('-');
      expectPath(cst, '0.delimiterWhitespaceEnd').to.equal(null);
      expectLocation(cst, '0');
    });

    it('should basically parse liquid tags', () => {
      cst = toLiquidHtmlCST('{%   assign x = 1 %}{% if hi -%}{%- endif %}');
      expectPath(cst, '0.type').to.equal('LiquidTag');
      expectPath(cst, '0.name').to.equal('assign');
      expectPath(cst, '0.markup').to.equal('x = 1');
      expectPath(cst, '0.whitespaceStart').to.equal(null);
      expectPath(cst, '0.whitespaceEnd').to.equal(null);
      expectPath(cst, '1.type').to.equal('LiquidTagOpen');
      expectPath(cst, '1.name').to.equal('if');
      expectPath(cst, '1.markup').to.equal('hi');
      expectPath(cst, '1.whitespaceStart').to.equal(null);
      expectPath(cst, '1.whitespaceEnd').to.equal('-');
      expectPath(cst, '2.type').to.equal('LiquidTagClose');
      expectPath(cst, '2.name').to.equal('if');
      expectPath(cst, '2.whitespaceStart').to.equal('-');
      expectPath(cst, '2.whitespaceEnd').to.equal(null);
      expectLocation(cst, '0');
    });

    it('should parse tag open / close', () => {
      BLOCKS.forEach((block: string) => {
        cst = toLiquidHtmlCST(`{% ${block} args -%}{%- end${block} %}`);
        expectPath(cst, '0.type').to.equal('LiquidTagOpen');
        expectPath(cst, '0.name').to.equal(block);
        expectPath(cst, '0.whitespaceStart').to.equal(null);
        expectPath(cst, '0.whitespaceEnd').to.equal('-');
        expectPath(cst, '0.markup').to.equal('args');
        expectPath(cst, '1.type').to.equal('LiquidTagClose');
        expectPath(cst, '1.name').to.equal(block);
        expectPath(cst, '1.whitespaceStart').to.equal('-');
        expectPath(cst, '1.whitespaceEnd').to.equal(null);
      });
    });
  });

  describe('Case: TextNode', () => {
    it('should parse text nodes', () => {
      ['<div>hello</div>', '{% if condition %}hello{% endif %}'].forEach((text) => {
        cst = toLiquidHtmlCST(text);
        expectPath(cst, '1.type').to.equal('TextNode');
        expectPath(cst, '1.value').to.equal('hello');
        expectLocation(cst, '1');
      });
    });

    it('should trim whitespace left and right', () => {
      [
        {
          testCase: '<div>  \n hello  world  </div>',
          expected: 'hello  world',
        },
        { testCase: '<div>  \n bb  </div>', expected: 'bb' },
        { testCase: '<div>  \n b  </div>', expected: 'b' },
        {
          testCase: '{% if a %}  \n hello  world  {% endif %}',
          expected: 'hello  world',
        },
        { testCase: '{% if a %}  \n bb  {% endif %}', expected: 'bb' },
        { testCase: '{% if a %}  \n b  {% endif %}', expected: 'b' },
      ].forEach(({ testCase, expected }) => {
        cst = toLiquidHtmlCST(testCase);
        expectPath(cst, '1.type').to.equal('TextNode');
        expectPathStringified(cst, '1.value').to.equal(JSON.stringify(expected));
        expectLocation(cst, '1');
      });
    });
  });

  it('should throw when trying to parse unparseable code', () => {
    const testCases = ['{% 10293 %}', '<h=>', '{% if', '{{ n', '<div>{{ n{% if'];
    for (const testCase of testCases) {
      try {
        toLiquidHtmlCST(testCase);
        expect(true, `expected ${testCase} to throw LiquidHTMLCSTParsingError`).to.be.false;
      } catch (e) {
        expect(e.name).to.eql('LiquidHTMLParsingError');
        expect(e.loc, `expected ${e} to have location information`).not.to.be.undefined;
      }
    }
  });

  it('should parse inline comments', () => {
    cst = toLiquidHtmlCST('{% # hello world \n # hi %}');
    expectPath(cst, '0.type').to.eql('LiquidTag');
    expectPath(cst, '0.name').to.eql('#');
    expectPath(cst, '0.markup').to.eql('hello world \n # hi');
    expectLocation(cst, '0');
  });

  function expectLocation(cst: LiquidHtmlCST, path: string) {
    expect(deepGet(path.split('.').concat('locStart'), cst)).to.be.a('number');
    expect(deepGet(path.split('.').concat('locEnd'), cst)).to.be.a('number');
  }

  function expectPath(cst: LiquidHtmlCST, path: string) {
    return expect(deepGet(path.split('.'), cst));
  }

  function expectPathStringified(cst: LiquidHtmlCST, path: string) {
    return expect(JSON.stringify(deepGet(path.split('.'), cst)));
  }
});
