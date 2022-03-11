<h1 align="center" style="position: relative;" >
  <br>
    <img src="https://github.com/Shopify/theme-check-vscode/blob/main/images/shopify_glyph.png?raw=true" alt="logo" width="150" height="160">
  <br>
  Shopify Liquid Prettier Plugin
  <br>
</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@shopify/prettier-plugin-liquid"><img src="https://img.shields.io/npm/v/@shopify/prettier-plugin-liquid.svg?sanitize=true" alt="Version"></a>
  <a href="https://github.com/Shopify/prettier-plugin-liquid/blob/main/LICENSE.md"><img src="https://img.shields.io/npm/l/@shopify/prettier-plugin-liquid.svg?sanitize=true" alt="License"></a>
  <!--
    <a href="https://npmcharts.com/compare/@shopify/prettier-plugin-liquid?minimal=true"><img src="https://img.shields.io/npm/dm/@shopify/prettier-plugin-liquid.svg?sanitize=true" alt="Downloads"></a>
  -->
</p>

<div align="center">

  🗣 [Slack](https://join.slack.com/t/shopifypartners/shared_invite/zt-sdr2quab-mGkzkttZ2hnVm0~8noSyvw) | 💬 [Discussions](https://github.com/Shopify/prettier-plugin-liquid/discussions) | 📝 [Changelog](./CHANGELOG.md)

</div>

Prettier is an opinionated code formatter. It enforces a consistent style by parsing your code and re-printing it with its own rules that take the maximum line length into account, wrapping code when necessary.

This plugin adds support for the Liquid/HTML language to Prettier.

## Can this be used in production?

Not yet. We have a list of issues we're going through before it is considered stable.

As such, **this is a developer preview of @shopify/prettier-plugin-liquid.**

## Intro 
Wanted to know how hard it is [to do like the Handlebars folks](https://prettier.io/blog/2021/05/09/2.3.0.html#:~:text=The%20feature%20is,under%20the%20hood.) and make a prettier plugin for Liquid.

Our problem: Liquid is a _templating_ language. As such, its Abstract Syntax Tree (AST) has no notion of what its text nodes contain.

And since [prettier](https://prettier.io/) is really a `function(ast) -> string`, you can't make pretty Liquid + HTML if the AST you have has no notion of HTML.

It's possible though:

https://user-images.githubusercontent.com/4990691/145229362-568ab7d4-4345-42b7-8794-59f7683a88a3.mp4

(That's what this prototype does)

## How we can handle it

First, we need to make a Liquid + HTML parser that supports a stricter form of Liquid.

That is, your Liquid + HTML should form a tree. This works:

```liquid
{% for product in all_products %}
  <img
    src="{{ product.featured_image | image_url }}"
    loading="lazy"
  >
{% endfor %}
```

Since it can be represented as this tree:

![docs/liquid-html-tree.png](docs/liquid-html-tree.png)

And since we can make a tree out of it we can print it into something _prettier_.

## How it works

1. We make an [harc/ohm](https://github.com/harc/ohm) grammar that parses the tokens of the source code. [(Link to LiquidHTML grammar.)](grammar/liquid-html.ohm)
2. We build a Concrete Syntax Tree (CST) with what Ohm gives us. [(Link to Grammar->CST code.)](src/parsers/liquid-html-cst.ts)
3. We build an AST from the CST. [(Link to CST->AST code.)](src/parsers/liquid-html-ast.ts)
4. We pass that AST to the prettier printer and output something pretty. [(Link to LiquidHTML printer)](src/printers/liquid-html-printer.ts)

**Notes:**

- A couple of key decisions were made to optimize development time and are _probably_ not good enough for production.
- I chose Ohm strictly because the syntax is pretty, easy to understand and allows me to skip all the nasty regular expression shenanigans.
- I chose prettier because it's the standard for pretty much every language out there. Also, [partners have been asking for it.](https://github.com/Shopify/theme-check-vscode/issues/32)
- I chose not to implement this directly in [theme-check](https://github.com/Shopify/theme-check) because there's a lot we gain from leveraging the [prettier printer API](https://prettier.io/docs/en/plugins.html#printers) and its [builder methods](https://github.com/prettier/prettier/blob/main/commands.md).

  This means that it's a separate install step. But I'm going with the assumption that folks who use prettier already have it installed.

  The alternative would be to build a prettier equivalent in ruby and isn't reasonable for a prototype.

## Liquid that can't be prettier

Like the Ember/Handlebars plugin, this prettier plugin only supports a _subset_ of Liquid. One that can be turned into a tree.

The most common use case that isn't supported is opening HTML tags inside a liquid if without closing it (and vice-versa):

```liquid
// not supported
{% if is_3d %}
  <product-media list=of props>
{% else %}
  <div>
{% endif %}
    content that goes in the middle
{% if is_3d %}
  </product-media>
{% else %}
  </div>
{% endif %}
```

When this happens, prettier will throw the following error:

```
example.liquid[error] example.liquid: LiquidHTMLParsingError: Attempting to close LiquidTag 'if' before HtmlElement 'div' was closed
[error]   3 |   <product-media list=of props>
[error]   4 | {% else %}
[error] > 5 |   <div>
[error]     |   ^^^^^
[error] > 6 | {% endif %}
[error]     | ^^^^^^^^^^^^
[error]   7 |     content that goes in the middle
[error]   8 | {% if is_3d %}
[error]   9 |   </product-media>
```

However... We _do_ support Liquid variables as HTML tag names.

```liquid
{% liquid
  if is_3d
    assign wrapper = 'product-media'
  else
    assign wrapper = 'div'
  endif
%}
<{{ wrapper }}>
  content that goes in the middle.
</{{ wrapper }}>
```

## Things that would make this production ready

- Go deep in the rabbit hole of edge cases

  * Run prettier on Dawn
  * Look at results
  * Write unit test for things that are not as you'd expect

- Handle whitespace trimming correctly when breaking a tag that was next to a drop.

  ```liquid
  {% if A %}{{ product.name }}{% endif %}

  {% # should turn into %}
  {% if A %}
    {{- product.name -}}
  {% endif %}
  ```

## Things that would be nice

- Elaborate LiquidTag syntax support
  * Potentially break on long list of arguments
- Elaborate LiquidDrop syntax support
  * Fix pipelines

## Things that I won't do

- Liquid + JavaScript (very hard)
- Liquid + CSS (hard)

### Reasoning

It should be a non-goal to make a great experience for JavaScript + Liquid or CSS + Liquid. Use cases like these are better served by leveraging the existing tooling from the community. If you need data provided by Liquid, all you need to do is dump it and then reference it as though it was a global object or CSS var.

```liquid
<!-- layout/theme.liquid -->
<script src="{{ 'bundle.js' | asset_url }}" defer></script>
<script>
  window.myThemeData = {
     dataINeed: {{ dataINeed | json }},
  }
</script>

{{ 'theme.css' | asset_url | stylesheet_tag: preload: true }}
<style>
  :root {
    --theme-background-color: {{ settingBackgroundColor }};
  }
</style>
```

```javascript
// assets/bundle.js
console.log(window.myThemeData.dataINeed);
```

```css
// assets/theme.css
body {
  background-color: var(--theme-background-color);
}
```

The benefit of going this way is that you can then use all the tooling you want for CSS or JavaScript independently of Liquid. e.g. prettier plugin for both languages, write your JavaScript in TypeScript, etc.
