import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function readJsonArray(path: string): Promise<unknown[]> {
  const value = JSON.parse(await readFile(resolve(path), "utf8")) as unknown;
  if (!Array.isArray(value)) throw new Error(`${path} debe contener un arreglo JSON.`);
  return value;
}

export async function readAllContent(): Promise<unknown[]> {
  const [general, teocratico] = await Promise.all([
    readJsonArray("content/general.json"),
    readJsonArray("content/teocratico.json")
  ]);
  return [...general, ...teocratico];
}
