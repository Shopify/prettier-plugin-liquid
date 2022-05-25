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
  <a href="https://github.com/Shopify/prettier-plugin-liquid-prototype/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Shopify/prettier-plugin-liquid-prototype/actions/workflows/ci.yml/badge.svg"></a>
  <!--
    <a href="https://npmcharts.com/compare/@shopify/prettier-plugin-liquid?minimal=true"><img src="https://img.shields.io/npm/dm/@shopify/prettier-plugin-liquid.svg?sanitize=true" alt="Downloads"></a>
  -->
</p>

<div align="center">

🗣 [Slack](https://join.slack.com/t/shopifypartners/shared_invite/zt-sdr2quab-mGkzkttZ2hnVm0~8noSyvw) | 💬 [Discussions](https://github.com/Shopify/prettier-plugin-liquid/discussions) | 📝 [Changelog](./CHANGELOG.md)

</div>

Prettier is an opinionated code formatter. It enforces a consistent style by parsing your code and re-printing it with its own rules that take the maximum line length into account, wrapping code when necessary.

**This is the developer preview** of the Liquid/HTML prettier plugin.

https://user-images.githubusercontent.com/4990691/145229362-568ab7d4-4345-42b7-8794-59f7683a88a3.mp4

## Can this be used in production?

_Not yet_. We have a [list of issues](https://github.com/Shopify/prettier-plugin-liquid/issues) we're going through before it is considered stable.

## Installation

yarn:

```bash
yarn add --dev prettier @shopify/prettier-plugin-liquid
# or globally
yarn global add prettier @shopify/prettier-plugin-liquid
```

npm:

```bash
npm install --save-dev prettier @shopify/prettier-plugin-liquid
# or globally
npm install --global prettier @shopify/prettier-plugin-liquid
```

## Usage

### With Node.js

#### As a local dependency

You can add prettier as a script in your `package.json`,

```json
{
  "scripts": {
    "prettier": "prettier"
  }
}
```

and then run it via

```bash
yarn run prettier path/to/file.liquid --write
# or
npm run prettier -- path/to/file.liquid --write
```

#### As a global dependency

If you installed the plugin globally, run

```bash
prettier path/to/file.liquid --write
```

### In the Browser

This package exposes a `standalone.js` that can be used alongside Prettier's own `standalone.js` to make the Liquid plugin work in browsers without a compile step.

First, grab both standalone scripts from an npm CDN like [unpkg](https://unpkg.com/):

```html
<script src="https://unpkg.com/prettier/standalone.js"></script>
<script src="https://unpkg.com/@shopify/prettier-plugin-liquid/standalone.js"></script>
```

Then use Prettier with Liquid, just like this:

```js
prettier.format(YOUR_CODE, {
  plugins: [prettierPluginLiquid],
  parser: 'liquid-html',
});
```

<!--
TODO: See this code in action [in this basic demo](https://jsbin.com/butoruw/edit?html,output).
-->

### With Bundlers

Bundlers like webpack, Rollup or browserify automatically recognize how to handle the plugin. Remember that even when using a bundler, you still have to use the standalone builds:

```js
import prettier from 'prettier/standalone';
import liquidPlugin from '@shopify/prettier-plugin-liquid/standalone';

prettier.format(YOUR_CODE, {
  plugins: [liquidPlugin],
  parser: 'liquid-html',
});
```

## Liquid that can't be prettier

Like the [Ember/Handlebars plugin](https://prettier.io/blog/2021/05/09/2.3.0.html#:~:text=The%20feature%20is,under%20the%20hood.), this prettier plugin only supports a _subset_ of Liquid: Liquid that can be turned into a tree.

A common use case that isn't supported is opening HTML tags inside a Liquid block without closing it (and vice-versa):

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

## Contributing

[Read our contributing guide](CONTRIBUTING.md)
