// Module resolve hook: @zos/* and @zeppos/zml/* -> test/mocks.
const MOCKS = new URL("../mocks/", import.meta.url);

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@zos/")) {
    return { url: new URL(`zos/${specifier.slice(5)}.js`, MOCKS).href, shortCircuit: true };
  }
  if (specifier.startsWith("@zeppos/zml/")) {
    return { url: new URL(`zml/${specifier.slice(12)}.js`, MOCKS).href, shortCircuit: true };
  }
  return next(specifier, context);
}
