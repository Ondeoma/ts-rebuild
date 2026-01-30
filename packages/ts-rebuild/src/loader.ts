import * as ts from "typescript";
import { PluginConfig, ProgramTransformerExtras } from "ts-patch";
import * as tsconfigPaths from "tsconfig-paths";

/*
 * Limited emulation of plugin loading of `ts-patch`.
 * If `ts-patch` exposes its loader, use it.
 * See https://github.com/nonara/ts-patch/issues/186 .
 */

const UNSUPPORTED_OPTIONS = new Set(["isEsm", "after", "afterDeclarations"]);

function validateConfig(config: PluginConfig) {
  for (const key of Object.keys(config)) {
    if (UNSUPPORTED_OPTIONS.has(key)) {
      throw new Error(`[Rebuilder] Option '${key}'`);
    }
  }
}

function resolveModulePath(
  transformPath: string,
  config: PluginConfig,
): string {
  if (config.resolvePathAliases) {
    const cleanup = tsconfigPaths.register();
    try {
      return require.resolve(transformPath, { paths: [process.cwd()] });
    } catch {
      // Fallback to default
    } finally {
      cleanup();
    }
  }
  return require.resolve(transformPath, { paths: [process.cwd()] });
}

// @internal
export function loadTransformerFactory(
  program: ts.Program,
  config: PluginConfig,
  extras: ProgramTransformerExtras,
): ts.TransformerFactory<ts.SourceFile> {
  validateConfig(config);

  const transformPath = config.transform;
  if (!transformPath)
    throw new Error(`[Rebuilder] Missing 'transform' in target.`);

  const modulePath = resolveModulePath(transformPath, config);
  const module = require(modulePath); // eslint-disable-line @typescript-eslint/no-require-imports

  const factoryCreator = config.import
    ? module[config.import]
    : module.default || module;

  if (typeof factoryCreator !== "function") {
    throw new Error(
      `[Rebuilder] Export '${config.import || "default"}' in ${modulePath} is not a function.`,
    );
  }

  const type = config.type || "program";

  const transformerFactory: ts.TransformerFactory<ts.SourceFile> = (() => {
    switch (type) {
      case "ls": // LanguageService Plugin
        throw new Error(
          `[Rebuilder] 'ls' type plugins are not supported in Rebuilder.`,
        );

      case "config": // (config) => TransformerFactory
        return factoryCreator(config);

      case "checker": // (checker, config) => TransformerFactory
        return factoryCreator(program.getTypeChecker(), config);

      case "raw": // TransformerFactory itself
        return factoryCreator;

      case "program":
      default:
        // (program, config, extras) => TransformerFactory
        return factoryCreator(program, config, extras);
    }
  })();

  return transformerFactory;
}
