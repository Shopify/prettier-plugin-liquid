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

A prettier formatter takes source code as input, and deterministically turn the output into pretty code by reprinting the Abstract Syntax Tree (AST for short).

That is, 

$$
\text{formattedCode} = f\left(\text{AST}, \text{Config}\right).
$$

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

### Example

The following liquid code could be our input:

```liquid
{%for product in all_products%}<img
  src="{{ product.featured_image | image_url }}"
    loading="lazy"
  >{%endfor %}
```

Our goal is to turn this into "pretty" code, and we do this first by parsing this code into an AST. Something like this:

```typescript
function parse(sourceCode: string): AST {
  // see parser docs for details :)
}

const input: string = `
{%for product in all_products%}<img
  src="{{ product.featured_image | image_url }}"
    loading="lazy"
  >{%endfor %}
`

const ast: AST = parse(input);
```

Once we have the AST, then we want


For the above `input`, we'd probably want our parser to turn this into an AST that looks like this:

```
const ast: AST = parse(input);
```

![docs/liquid-html-tree.png](../liquid-html-tree.png)

## Important mathematical properties of prettier formatters

_(This section is optional)_

One of the desirable properties of prettier is that it is [Idempotent](https://en.wikipedia.org/wiki/Idempotence). That is, running it twice on the same source code will return the same result.

In other words:

$$
\text{format}\left(\text{sourceCode}, \text{Config}\right) 
= \text{format}\left(
    \text{format}\left(
      \text{sourceCode}, \text{Config}
    \right), 
    \text{Config}
  \right)
$$

Recall the equation we have for prettier code:

$$
\text{formattedCode} = f\left(\text{AST}, \text{Config}\right)
$$

Since prettier code shouldn't change the AST, it follows that parsing the prettier code should return an AST equivalent to the AST parsed from the non-pretty code:

$$
\text{parse(\text{PrettierCode})} = \text{parse}(\text{sourceCode})
$$

Since the parser should return the same AST.

## Where to go from here

- [The parser](The parser)
- [The printer](The printer)
