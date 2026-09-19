export function shouldSkipStaleRender(generation, currentGeneration, nodes = []) {
  if (generation !== currentGeneration) return true;
  const live = nodes.filter(Boolean);
  if (!live.length) return true;
  return live.every((node) => !node.isConnected);
}
