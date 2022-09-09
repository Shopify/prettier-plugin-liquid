
0.4.0 / 2022-09-09
==================

## Features

  * Add support for the `{% liquid %}` tag ([#94](https://github.com/shopify/prettier-plugin-liquid/issues/94))
  * Add support for embedded languages ([#88](https://github.com/shopify/prettier-plugin-liquid/issues/88))
    * Use prettier's JavaScript formatter inside `<script>` and `{% javascript %}` tags
    * Use prettier's CSS formatter inside `<style>` and `{% style %}` tags
    * Use prettier's JSON formatter inside `<script type="anything/that-ends-in-json">` and `{% schema %}` tags
    * Use prettier's Markdown formatter inside `<script type="text/markdown">`
    * Add a new configuration: `embeddedSingleQuote` to control the `singleQuote` property of embedded languages
      * When `true` (default), will prefer single quotes inside embedded JS & CSS

## Fixes

  * Fix grammar precedence (>=, <=) for operators in conditionals ([#98](https://github.com/shopify/prettier-plugin-liquid/issues/98))

0.3.1 / 2022-08-31
==================

  * Fixup printing of failed-to-parse Liquid ([#95](https://github.com/shopify/prettier-plugin-liquid/issues/95))

0.3.0 / 2022-08-26
==================

## Features

  * Add [online playground](https://shopify.github.io/prettier-plugin-liquid/) ([#86](https://github.com/shopify/prettier-plugin-liquid/issues/86))
  * Add support for `{% # prettier-ignore %}` ([#85](https://github.com/shopify/prettier-plugin-liquid/issues/85))
  * Add support for the `assign` tag ([#54](https://github.com/shopify/prettier-plugin-liquid/issues/54))
  * Add support for the `echo` liquid tag ([#54](https://github.com/shopify/prettier-plugin-liquid/issues/54))
  * Add support for the `section` tag ([#73](https://github.com/shopify/prettier-plugin-liquid/issues/73))
  * Add support for the `if`, `elsif` and `unless` tags ([#77](https://github.com/shopify/prettier-plugin-liquid/issues/77))
  * Add support for the `render` and `include` tags ([#56](https://github.com/shopify/prettier-plugin-liquid/issues/56))
  * Add support for the `form` tag ([#75](https://github.com/shopify/prettier-plugin-liquid/issues/75))
  * Add support for the `capture` open tag parsing ([#84](https://github.com/shopify/prettier-plugin-liquid/issues/84))
  * Add support for the `case` and `when` tag ([#78](https://github.com/shopify/prettier-plugin-liquid/issues/78))
  * Add support for the `cycle` tag ([#81](https://github.com/shopify/prettier-plugin-liquid/issues/81))
  * Add support for the `for` tag ([#79](https://github.com/shopify/prettier-plugin-liquid/issues/79))
  * Add support for the `increment` and `decrement` tags ([#82](https://github.com/shopify/prettier-plugin-liquid/issues/82))
  * Add support for the `layout` tag ([#80](https://github.com/shopify/prettier-plugin-liquid/issues/80))
  * Add support for the `paginate` tag ([#76](https://github.com/shopify/prettier-plugin-liquid/issues/76))
  * Add support for the `tablerow` tag ([#79](https://github.com/shopify/prettier-plugin-liquid/issues/79))
  * Prefer `null` over `nil`
  * Strip markup from tags that don't take arguments

0.2.1 / 2022-08-10
==================

  * Add partial support for Liquid inside YAML frontmatter ([#71](https://github.com/Shopify/prettier-plugin-liquid/issues/71))

0.2.0 / 2022-08-08
==================

## Features

  * Adds pretty-printing of Liquid objects and filters ([#41](https://github.com/Shopify/prettier-plugin-liquid/pull/41) and [#46](https://github.com/Shopify/prettier-plugin-liquid/pull/46))
  * Adds the `liquidSingleQuote` configuration option
    * Prefer single quotes inside Liquid strings
    * `true` by default

## Fixes

  * Add YAML frontmatter support ([#29](https://github.com/Shopify/prettier-plugin-liquid/issues/29))
  * Fix custom-element parsing ([#37](https://github.com/Shopify/prettier-plugin-liquid/issues/37)) (Thank you @qw-in!)

0.1.4 / 2022-06-02
==================

  * Add support for Liquid inline comments (`{% # hello world %}`) [#28](https://github.com/Shopify/prettier-plugin-liquid/pull/28)
  * Fix support of attribute names to be spec-compliant (e.g. AlpineJS attributes) [#27](https://github.com/Shopify/prettier-plugin-liquid/pull/27)

0.1.3 / 2022-05-31
==================

  * Micro refactor of node.isLeadingWhitespaceSensitive && !node.hasLeadingWhitespace
  * Add gif to README

0.1.2 / 2022-05-30
==================

  * Public access
  * Fixup reindent bug

0.1.1 / 2022-05-30
==================

  * theme-check compatible defaults

0.1.0 / 2022-05-27
==================

  * Initial release
