This set of documents exists to help you learn how to contribute to this repo.

If I do my job right, you should feel empowered to make changes and feel smart while doing it.

## My promise

Making a formatter is not _harder_ than any other programming problem. It is _different_ and _uncommon_. 

Since it's **different** than your typical frontend/backend work, it usually implies that there's more stuff you don't know. You're less familiar with the problem space.

Since it's **uncommon**, it usually implies that there aren't as much docs online in this problem space. Less docs also means terser or harder to read docs.

Both of these don't change the problem or their difficulty, they only change how you should think about approaching them.

In general, this means you need to **spend more time learning** than you would on your typical project. 

Thankfully, once your tree of knowledge has been built, you can then regain the confidence you might have built working on problems that are more familiar.

My hope is that those docs help you speed things up a little bit.

## So what's in this formatter?

A prettier printer takes an _Abstract Syntax Tree (AST)_ and a _configuration_ as input, and returns _pretty code_.

That is,

$$
\text{prettyCode} = print\left(\text{sourceCode}, \text{Config}\right).
$$

But since we're mostly dealing with source code, we need a step that turns source code into an Abstract Syntax Tree. That step is performed by the _parser_.

As such, there are two major pipelines in this codebase:

- [A parser](parser.md)
- [A printer](printer.md)

It's the **parser**'s job to turn a `string` representation of the source code into an AST.

It's the **printer**'s job to turn an AST into pretty code.

It's the **formatter**'s job to take the result of the parser and pipe it into the printer.

If you like types, it's a bit like this:

```typescript
type Parser = (sourceCode: string) => AST
type Printer = (ast: AST, config: Config) => string
type Formatter = (sourceCode: string, config: Config) => string
```

If you like math, it's a bit like this:
```math
\begin{align}
\text{AST} & = \text{parse}(\text{sourceCode}) \\\\
\text{prettyCode} & = \text{print}(\text{AST}, \text{Config}) \\\\
\text{prettyCode} & = \text{format}(\text{sourceCode}, \text{Config}) = \text{print}(\text{parse(sourceCode)}, \text{Config})
\end{align}
```

### Example

Take the following code as input:

```liquid
{%for product in all_products%}
  <img
    src="{{ product.featured_image | image_url }}"
    loading="lazy"
  >
{%endfor %}
```

Since our goal is to turn this into "pretty" code, our first job is to turn it into an AST.

```typescript
function parse(sourceCode: string): AST {
  // see parser docs for details :D
}

const input: string = `
{%for product in all_products%}
  <img
    src="{{ product.featured_image | image_url }}"
    loading="lazy"
  >
{%endfor %}
`

const ast: AST = parse(input);
```

And then we need to pass that AST to the printer.

```typescript
function print(ast: AST, config: Config): string {
  // see printer docs for details :D
}

const prettyCode: string = print(ast, getPrettierRcConfig());
```

So our formatter is really just the combination of the two:

```typescript
function format(sourceCode: string, config: Config): string {
  const ast: AST = parse(sourceCode);
  return print(ast, config);
}
```

## Where to go from here

- [The parser](parser.md)
- [The printer](printer.md)
