import * as ts from "typescript";
import { PluginConfig, ProgramTransformerExtras, TransformerExtras } from "ts-patch";

import { loadTransformerFactory } from "./loader";

export interface RebuilderConfig extends PluginConfig {
  children?: PluginConfig[];
}

export default function (
  program: ts.Program,
  host: ts.CompilerHost | undefined,
  config: RebuilderConfig,
  programExtras: ProgramTransformerExtras,
): ts.Program {
  const children = config.children || [];
  if (children.length === 0) return program;

  const diagnostics: ts.Diagnostic[] = [];
  const extras: TransformerExtras = {
    ...programExtras,
    diagnostics,
    addDiagnostic: (diag: ts.Diagnostic): number => diagnostics!.push(diag),
    removeDiagnostic: (index: number) => { diagnostics!.splice(index, 1) },
    library: (globalThis as any).tsp?.currentLibrary || "typescript",
  };

  const factories = children.map((targetConfig) =>
    loadTransformerFactory(program, targetConfig, extras),
  );

  const printer = ts.createPrinter();
  const newSourceFiles = new Map<string, ts.SourceFile>(
    program
      .getSourceFiles()
      .filter((sourceFile) => !sourceFile.isDeclarationFile)
      .map((sourceFile) => ts.transform(sourceFile, factories))
      .flatMap((result) => result.transformed)
      .map((transformed) => {
        const newContent = printer.printFile(transformed);
        const cleanSourceFile = ts.createSourceFile(
          transformed.fileName,
          newContent,
          transformed.languageVersion,
          true,
        );
        return cleanSourceFile;
      })
      .map((transformed) => [transformed.fileName, transformed]),
  );

  const compilerOptions = program.getCompilerOptions();

  const baseHost = host || ts.createCompilerHost(compilerOptions);
  const getSourceFile: typeof baseHost.getSourceFile = (
    fileName,
    languageVersion,
    onError,
    shouldCreateNewSourceFile,
  ) => {
    if (newSourceFiles.has(fileName)) return newSourceFiles.get(fileName)!;
    return baseHost.getSourceFile(
      fileName,
      languageVersion,
      onError,
      shouldCreateNewSourceFile,
    );
  };
  const newHost = {
    ...baseHost,
    getSourceFile,
  };

  const newProgram = ts.createProgram({
    rootNames: program.getRootFileNames(),
    options: compilerOptions,
    host: newHost,
  });

  const originalEmit = newProgram.emit;
  newProgram.emit = function (
    targetSourceFile,
    writeFile,
    cancellationToken,
    emitOnlyDtsFiles,
    customTransformers
  ) {
    const result = originalEmit.call(
      this,
      targetSourceFile,
      writeFile,
      cancellationToken,
      emitOnlyDtsFiles,
      customTransformers
    );
    for (const diag of diagnostics) {
      if (!result.diagnostics.includes(diag)) {
        (result.diagnostics as ts.Diagnostic[]).push(diag);
      }
    }
    return result;
  };

  console.log("ts-rebuild successfully create new program.");

  return newProgram;
}
