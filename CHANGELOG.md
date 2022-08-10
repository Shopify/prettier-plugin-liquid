
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
