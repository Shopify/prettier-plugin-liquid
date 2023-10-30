# The printer

For official docs, refer to [prettier's plugin docs](https://prettier.io/docs/en/plugins.html#the-printing-process).

The rest of this doc can be looked as a summary / interpretation useful for working in this codebase.

## TL;DR

- `print(path, options, print, args)` is a function that recursively outputs a `Doc`.
  - It is how we integrate into prettier's plugin system.
  - It looks like a _giant_ `switch` statement that switches on the current `LiquidHtmlNode`'s type. Nodes will then recursively call `print` on their children, and thus reenter the giant switch statement for every node.
    - TypeScript's discriminated union is a VERY useful feature here.
- You can think of a `Doc` as `string`, `Doc[]`, or the output of one of prettier's `doc.builders`.
- Prettier then takes the resulting `Doc` and pretty-prints it based on the configuration values (such as `printWidth`).

It looks a bit like this:

```typescript
function print(
  path: AstPath<LiquidHtmlNode>,
  options: LiquidPrinterOptions,
  print: LiquidPrinter,
  args: LiquidPrinterArguments,
): Doc {
  const node = path.getValue(); // LiquidHtmlNode
  switch (node.type) {
    case 'Document':
      return path.map(print, 'children');

    case 'HtmlAttribute':
      return [node.name, '=', path.call(print, 'value')]

    case 'HtmlAttributeDoubleQuoted':
      return ['"', path.call(print, 'value'), '"']

    case 'HtmlAttributeSingleQuoted':
      return ["'", path.call(print, 'value'), "'"]

    case 'TextNode':
      return node.value;

    // etc.
  }
}
```

## Where to go from here

- [What's a Doc, doc?](doc.md)
- [What's a builder?](doc-builders.md)
- What are common patterns?
