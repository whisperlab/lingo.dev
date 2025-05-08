import { parse } from "@babel/parser";
import babelTraverseModule from "@babel/traverse";
import type { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import babelGenerateModule from "@babel/generator";
import { flatten, unflatten } from "flat";
import _ from "lodash";
import { ILoader } from "../_types";
import { createLoader } from "../_utils";
import { resolveCjsExport } from "./cjs-interop";

const traverse: any = resolveCjsExport(babelTraverseModule, "@babel/traverse");
const generate: any = resolveCjsExport(babelGenerateModule, "@babel/generator");

export default function createTypescriptLoader(): ILoader<
  string,
  Record<string, any>
> {
  return createLoader({
    pull: async (locale, input) => {
      if (!input) {
        return {};
      }

      try {
        const ast = parseTypeScript(input);
        const extractedStrings = extractStringsFromDefaultExport(ast);
        return flattenExtractedStrings(extractedStrings);
      } catch (error) {
        console.error("Error parsing TypeScript file:", error);
        return {};
      }
    },
    push: async (
      locale,
      data,
      originalInput,
      defaultLocale,
      pullInput,
      pullOutput,
    ) => {
      if (!data) {
        return "";
      }

      const input = pullInput as string;
      
      if (!input) {
        console.error("No input provided for locale:", locale);
        return "";
      }

      try {
        const ast = parseTypeScript(input);
        
        const currentStrings = extractStringsFromDefaultExport(ast);
        const flattenedCurrentStrings = flattenExtractedStrings(currentStrings);
        
        const nestedData = unflattenStringData(data);
        
        const modified = updateStringsInDefaultExport(
          ast, 
          nestedData, 
          locale === defaultLocale
        );

        if (!modified) {
          return input;
        }

        const { code } = generate(ast);
        return code;
      } catch (error) {
        console.error("Error updating TypeScript file:", error);
        return input;
      }
    },
  });
}

/**
 * Parse TypeScript code into an AST
 */
function parseTypeScript(input: string) {
  return parse(input, {
    sourceType: "module",
    plugins: ["typescript"],
  });
}

/**
 * Flatten nested object structure into dot-notation paths
 * and filter out non-string values
 */
/**
 * Flatten nested object structure into dot-notation paths
 * and filter out non-string values
 */
function flattenExtractedStrings(
  obj: Record<string, any>,
): Record<string, string> {
  const flattened = flatten(obj, { delimiter: "/" }) as Record<string, any>;

  // Filter out non-string values
  return Object.entries(flattened).reduce(
    (acc, [key, value]) => {
      if (typeof value === "string") {
        acc[key] = value;
      }
      return acc;
    },
    {} as Record<string, string>,
  );
}

/**
 * Unflatten dot-notation paths back into nested object structure
 */
function unflattenStringData(
  data: Record<string, string>,
): Record<string, any> {
  return unflatten(data, { delimiter: "/" });
}

/**
 * Extract string literals from a default export in TypeScript
 */
function extractStringsFromDefaultExport(ast: t.File): Record<string, any> {
  const result: Record<string, any> = {};

  traverse(ast, {
    ExportDefaultDeclaration(path: NodePath<t.ExportDefaultDeclaration>) {
      if (t.isObjectExpression(path.node.declaration)) {
        extractStringsFromObjectExpression(path.node.declaration, result, "");
      } else if (t.isIdentifier(path.node.declaration)) {
        extractStringsFromExportedIdentifier(path, result, "");
      }
    },
  });

  return result;
}

/**
 * Extract string literals from an object expression with path tracking for nesting
 */
function extractStringsFromObjectExpression(
  objectExpression: t.ObjectExpression,
  result: Record<string, any>,
  path: string,
): void {
  objectExpression.properties.forEach((prop) => {
    if (t.isObjectProperty(prop)) {
      const key = getPropertyKey(prop);
      const currentPath = path ? `${path}/${key}` : key;

      if (t.isStringLiteral(prop.value)) {
        _.set(result, currentPath, prop.value.value);
      } else if (t.isObjectExpression(prop.value)) {
        extractStringsFromObjectExpression(prop.value, result, currentPath);
      } else if (t.isArrayExpression(prop.value)) {
        extractStringsFromArrayExpression(prop.value, result, currentPath);
      }
    }
  });
}

/**
 * Extract string literals from an array expression
 */
function extractStringsFromArrayExpression(
  arrayExpression: t.ArrayExpression,
  result: Record<string, any>,
  path: string,
): void {
  arrayExpression.elements.forEach((element, index) => {
    const currentPath = `${path}/${index}`;

    if (t.isStringLiteral(element)) {
      _.set(result, currentPath, element.value);
    } else if (t.isObjectExpression(element)) {
      extractStringsFromObjectExpression(element, result, currentPath);
    } else if (t.isArrayExpression(element)) {
      extractStringsFromArrayExpression(element, result, currentPath);
    }
  });
}

/**
 * Extract string literals from an exported identifier (variable)
 */
function extractStringsFromExportedIdentifier(
  path: NodePath<t.ExportDefaultDeclaration>,
  result: Record<string, any>,
  basePath: string,
): void {
  const exportName = (path.node.declaration as t.Identifier).name;
  const binding = path.scope.bindings[exportName];

  if (binding && binding.path.node) {
    const bindingPath = binding.path;

    if (t.isVariableDeclarator(bindingPath.node) && bindingPath.node.init) {
      if (t.isObjectExpression(bindingPath.node.init)) {
        extractStringsFromObjectExpression(
          bindingPath.node.init,
          result,
          basePath,
        );
      } else if (t.isArrayExpression(bindingPath.node.init)) {
        extractStringsFromArrayExpression(
          bindingPath.node.init,
          result,
          basePath,
        );
      }
    }
  }
}

/**
 * Update string literals in a default export with new values
 */
function updateStringsInDefaultExport(
  ast: t.File,
  data: Record<string, any>,
  isSourceLocale: boolean = true,
): boolean {
  let modified = false;

  traverse(ast, {
    ExportDefaultDeclaration(path: NodePath<t.ExportDefaultDeclaration>) {
      if (t.isObjectExpression(path.node.declaration)) {
        modified =
          updateStringsInObjectExpression(path.node.declaration, data, "", isSourceLocale) ||
          modified;
      } else if (t.isIdentifier(path.node.declaration)) {
        modified =
          updateStringsInExportedIdentifier(path, data, "", isSourceLocale) || modified;
      }
    },
  });

  return modified;
}

/**
 * Update string literals in an object expression with new values
 */
function updateStringsInObjectExpression(
  objectExpression: t.ObjectExpression,
  data: Record<string, any>,
  path: string,
  isSourceLocale: boolean = true,
): boolean {
  let modified = false;

  objectExpression.properties.forEach((prop) => {
    if (t.isObjectProperty(prop)) {
      const key = getPropertyKey(prop);
      const currentPath = path ? `${path}/${key}` : key;

      if (t.isStringLiteral(prop.value)) {
        if (isSourceLocale) {
          if (data[currentPath] !== undefined) {
            prop.value.value = data[currentPath];
            modified = true;
          } else if (path === "" && data[key] !== undefined) {
            prop.value.value = data[key];
            modified = true;
          }
        }
      } else if (t.isObjectExpression(prop.value)) {
        if (data[key] && typeof data[key] === "object") {
          const subModified = updateStringsInObjectExpression(
            prop.value,
            data[key],
            "",
            isSourceLocale,
          );
          modified = subModified || modified;
        } else {
          const subModified = updateStringsInObjectExpression(
            prop.value,
            data,
            currentPath,
            isSourceLocale,
          );
          modified = subModified || modified;
        }
      } else if (t.isArrayExpression(prop.value)) {
        if (data[key] && Array.isArray(data[key])) {
          const subModified = updateStringsInArrayExpression(
            prop.value,
            data[key],
            "",
            isSourceLocale,
          );
          modified = subModified || modified;
        } else {
          const subModified = updateStringsInArrayExpression(
            prop.value,
            data,
            currentPath,
            isSourceLocale,
          );
          modified = subModified || modified;
        }
      }
    }
  });

  return modified;
}

/**
 * Update string literals in an array expression
 */
function updateStringsInArrayExpression(
  arrayExpression: t.ArrayExpression,
  data: Record<string, any> | any[],
  path: string,
  isSourceLocale: boolean = true,
): boolean {
  let modified = false;

  arrayExpression.elements.forEach((element, index) => {
    const currentPath = `${path}/${index}`;

    if (t.isStringLiteral(element)) {
      if (isSourceLocale) {
        if (Array.isArray(data) && data[index] !== undefined) {
          element.value = data[index];
          modified = true;
        } else if (!Array.isArray(data) && data[currentPath] !== undefined) {
          element.value = data[currentPath];
          modified = true;
        }
      }
    } else if (t.isObjectExpression(element)) {
      if (
        Array.isArray(data) &&
        data[index] &&
        typeof data[index] === "object"
      ) {
        const subModified = updateStringsInObjectExpression(
          element,
          data[index],
          "",
          isSourceLocale,
        );
        modified = subModified || modified;
      } else {
        const subModified = updateStringsInObjectExpression(
          element,
          data,
          currentPath,
          isSourceLocale,
        );
        modified = subModified || modified;
      }
    } else if (t.isArrayExpression(element)) {
      if (Array.isArray(data) && data[index] && Array.isArray(data[index])) {
        const subModified = updateStringsInArrayExpression(
          element,
          data[index],
          "",
          isSourceLocale,
        );
        modified = subModified || modified;
      } else {
        const subModified = updateStringsInArrayExpression(
          element,
          data,
          currentPath,
          isSourceLocale,
        );
        modified = subModified || modified;
      }
    }
  });

  return modified;
}

/**
 * Update string literals in an exported identifier (variable) with new values
 */
function updateStringsInExportedIdentifier(
  path: NodePath<t.ExportDefaultDeclaration>,
  data: Record<string, any>,
  basePath: string,
  isSourceLocale: boolean = true,
): boolean {
  let modified = false;
  const exportName = (path.node.declaration as t.Identifier).name;
  const binding = path.scope.bindings[exportName];

  if (binding && binding.path.node) {
    const bindingPath = binding.path;

    if (t.isVariableDeclarator(bindingPath.node) && bindingPath.node.init) {
      if (t.isObjectExpression(bindingPath.node.init)) {
        modified =
          updateStringsInObjectExpression(
            bindingPath.node.init,
            data,
            basePath,
            isSourceLocale,
          ) || modified;
      } else if (t.isArrayExpression(bindingPath.node.init)) {
        modified =
          updateStringsInArrayExpression(
            bindingPath.node.init,
            data,
            basePath,
            isSourceLocale,
          ) || modified;
      }
    }
  }

  return modified;
}

/**
 * Get the string key from an object property
 */
function getPropertyKey(prop: t.ObjectProperty): string {
  if (t.isIdentifier(prop.key)) {
    return prop.key.name;
  } else if (t.isStringLiteral(prop.key)) {
    return prop.key.value;
  }
  return String(prop.key);
}
