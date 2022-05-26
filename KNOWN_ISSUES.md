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
