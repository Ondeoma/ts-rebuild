import * as ts from "typescript";
import {
  PluginConfig,
  ProgramTransformerExtras,
  TransformerExtras,
} from "ts-patch";

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

  const extras: TransformerExtras = createExtras(programExtras);

  const factories = children.map((targetConfig) =>
    loadTransformerFactory(program, targetConfig, extras),
  );

  const newSourceFiles = transform(program, factories);

  const compilerOptions = program.getCompilerOptions();

  const newHost = createNewHost(host, compilerOptions, newSourceFiles);

  const newProgram = createNewProgram(
    program,
    compilerOptions,
    newHost,
    extras.diagnostics,
  );

  console.log("ts-rebuild successfully create new program.");

  return newProgram;
}

function createExtras(
  programExtras: ProgramTransformerExtras,
): TransformerExtras {
  const diagnostics: ts.Diagnostic[] = [];
  const extras: TransformerExtras = {
    ...programExtras,
    diagnostics,
    addDiagnostic: (diag: ts.Diagnostic): number => diagnostics!.push(diag),
    removeDiagnostic: (index: number) => {
      diagnostics!.splice(index, 1);
    },
    library: "typescript",
  };
  return extras;
}

function transform(
  program: ts.Program,
  factories: ts.TransformerFactory<ts.SourceFile>[],
): Map<string, ts.SourceFile> {
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
  return newSourceFiles;
}

function createNewHost(
  host: ts.CompilerHost | undefined,
  compilerOptions: ts.CompilerOptions,
  newSourceFiles: Map<string, ts.SourceFile>,
): ts.CompilerHost {
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
  return newHost;
}

function createNewProgram(
  program: ts.Program,
  compilerOptions: ts.CompilerOptions,
  host: ts.CompilerHost,
  deltaDiagnostics: readonly ts.Diagnostic[],
): ts.Program {
  const newProgram = ts.createProgram({
    rootNames: program.getRootFileNames(),
    options: compilerOptions,
    host,
  });

  const originalEmit = newProgram.emit;
  newProgram.emit = function (
    targetSourceFile,
    writeFile,
    cancellationToken,
    emitOnlyDtsFiles,
    customTransformers,
  ) {
    const result = originalEmit.call(
      this,
      targetSourceFile,
      writeFile,
      cancellationToken,
      emitOnlyDtsFiles,
      customTransformers,
    );
    const cleanDeltaDiagnostics = deltaDiagnostics.filter(
      (diag) => !result.diagnostics.includes(diag),
    );
    result.diagnostics = result.diagnostics.concat(cleanDeltaDiagnostics);
    return result;
  };

  return newProgram;
}
