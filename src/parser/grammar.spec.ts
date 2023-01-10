import { expect } from 'chai';
import { liquidHtmlGrammar, liquidStatementsGrammar } from '~/parser/grammar';

describe('Unit: liquidHtmlGrammar', () => {
  it('should parse or not parse HTML+Liquid', () => {
    expectMatchSucceeded('<h6 data-src="hello world">').to.be.true;
    expectMatchSucceeded('<a src="https://product"></a>').to.be.true;
    expectMatchSucceeded('<a src="https://google.com"></b>').to.be.true;
    expectMatchSucceeded(`<img src="hello" loading='lazy' enabled=true disabled>`).to.be.true;
    expectMatchSucceeded(`<img src="hello" loading='lazy' enabled=true disabled />`).to.be.true;
    expectMatchSucceeded(`<{{header_type}}-header>`).to.be.true;
    expectMatchSucceeded(`<header--{{header_type}}>`).to.be.true;
    expectMatchSucceeded(`<-nope>`).to.be.false;
    expectMatchSucceeded(`<:nope>`).to.be.false;
    expectMatchSucceeded(`<1nope>`).to.be.false;
    expectMatchSucceeded(`{{ product.feature }}`).to.be.true;
    expectMatchSucceeded(`{{product.feature}}`).to.be.true;
    expectMatchSucceeded(`{%- if A -%}`).to.be.true;
    expectMatchSucceeded(`{%-if A-%}`).to.be.true;
    expectMatchSucceeded(`{%- else-%}`).to.be.true;
    expectMatchSucceeded(`{%- liquid-%}`).to.be.true;
    expectMatchSucceeded(`{%- schema-%}`).to.be.true;
    expectMatchSucceeded(`{%- form-%}`).to.be.true;
    expectMatchSucceeded(`{{ true-}}`).to.be.true;
    expectMatchSucceeded(`
      <html>
        <head>
          {{ 'foo' | script_tag }}
        </head>
        <body>
          {% if true %}
            <div>
              hello world
            </div>
          {% else %}
            nope
          {% endif %}
        </body>
      </html>
    `).to.be.true;
    expectMatchSucceeded(`
      <input
        class="[[ cssClasses.checkbox ]] form-checkbox sm:text-[8px]"
        type="checkbox"

        [[# isRefined ]]
          checked
        [[/ isRefined ]]
      />
    `).to.be.true;
    expectMatchSucceeded(`
      <svg>
          <svg a=1><svg b=2>
            <path d="M12"></path>
          </svg></svg>
      </svg>
    `).to.be.true;
    expectMatchSucceeded(`<div data-popup-{{ section.id }}="size-{{ section.id }}">`).to.be.true;
    expectMatchSucceeded('<img {% if aboveFold %} loading="lazy"{% endif %} />').to.be.true;
    expectMatchSucceeded('<svg><use></svg>').to.be.true;
    expectMatchSucceeded('<6h>').to.be.false;

    function expectMatchSucceeded(text: string) {
      const match = liquidHtmlGrammar.match(text, 'Node');
      return expect(match.succeeded());
    }
  });

  it('should parse or not parse {% liquid %} lines', () => {
    expectMatchSucceeded(`
      layout none

      paginate search.results by 28
        for item in search.results
          if item.object_type != 'product'
            continue
          endif

          render 'product-item', product: item
        endfor
      endpaginate
    `).to.be.true;

    function expectMatchSucceeded(text: string) {
      const match = liquidStatementsGrammar.match(text.trimStart(), 'Node');
      return expect(match.succeeded());
    }
  });
});
