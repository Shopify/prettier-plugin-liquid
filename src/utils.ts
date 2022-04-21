import { Position } from './types';

export function assertNever(x: never): never {
  throw new Error(`Unexpected object: ${x}`);
}

export function locStart(node: { position: Position }) {
  return node.position.start;
}

export function locEnd(node: { position: Position }) {
  return node.position.end;
}
