export function randoms(count: number): Float32Array {
  const values = new Float32Array(count);
  for (let i = 0; i < count; i++) values[i] = Math.random();
  return values;
}

export function gaussian(): number {
  return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
}
