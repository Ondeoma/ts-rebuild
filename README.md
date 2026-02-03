# ts-rebuild

This is a Program Transformer that wraps other Source Transformers and rebuilds the `ts.Program` to update the `TypeChecker`.
It is designed for use with [ts-patch](https://github.com/nonara/ts-patch).


## Usage

Configure it in your `tsconfig.json` as follows:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "@ondeoma/ts-rebuild",
        "transformProgram": true,
        "children": [
          { "transform": "some-type-changing-transformer" }
        ]
      },
      { "transform": "transformer-needs-updated-typechecker" }
    ]
  }
}
```

See `packages/example` for a complete example.


## Background

Standard Source Transformers modify the AST (Abstract Syntax Tree),
  but TypeScript does not automatically update the TypeChecker to reflect these changes.
This causes issues when subsequent transformers depend on up-to-date type information (e.g., retrieving types of newly generated nodes).

`ts-rebuild` solves this by wrapping your Source Transformers and acting as a Program Transformer.
It ensures the `TypeChecker` is refreshed after the source transformations are applied,
  allowing downstream transformers to work correctly.