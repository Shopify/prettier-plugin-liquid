# Idempotence

_(This section is optional)_

One of the desirable properties of prettier is that it is [Idempotent](https://en.wikipedia.org/wiki/Idempotence). That is, **running it twice on the same source code will return the same result**.

In other words, we desire the following:

```math
\text{format}\left(\text{prettyCode}, \text{Config}\right)
= \text{format}\left(\text{sourceCode}, \text{Config}\right)
```

## Proof and condition

Recall the equations we have for prettier code:

```math
\begin{align}
\text{AST} & = \text{parse}(\text{sourceCode}) \\\\
\text{prettyCode} & = \text{print}(\text{AST}, \text{Config}) \\\\
\text{prettyCode} & = \text{format}(\text{sourceCode}, \text{Config}) = \text{print}(\text{parse(sourceCode)}, \text{Config})
\end{align}
```

If we decide that **prettier code shouldn't change the AST**, then it follows that parsing the prettier code should return an AST equivalent to the AST parsed from the non-pretty code: 

```math
\begin{align}
\text{If} \quad & \text{AST}_{after}  & = & \quad \text{AST}_{before}, \\\\
\text{then} \quad & \text{parse}\left(\text{prettyCode}\right) & = & \quad \text{parse}\left(\text{sourceCode}\right).
\end{align}
```

Since the ASTs are equal, and since printing is _pure_, then we can conclude that printing both sides of the equation returns the same result:

```math
\begin{align}
\implies & \quad \text{print}(\text{AST}_{after}, \text{Config}) & = & \quad \text{print}(\text{AST}_{before}, \text{Config}) \\\\
\implies & \quad \text{print}(\text{parse}(\text{prettyCode}), \text{Config}) & = & \quad \text{print}(\text{parse}(\text{sourceCode}), \text{Config}) \\\\
\implies & \quad \text{format}\left(\text{prettyCode}, \text{Config}\right)
& = & \quad \text{format}\left(\text{sourceCode}, \text{Config}\right)
\end{align}
```

Which is what we want.

## Conclusion

If we want `format(prettyCode) == format(sourceCode)`, then we need to spit out an equivalent AST and our 
