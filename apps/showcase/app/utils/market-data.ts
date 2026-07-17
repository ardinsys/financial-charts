import type { ChartData } from "@ardinsys/financial-charts";

export const STEP_SIZE = 15 * 60 * 1000;

export function createMarketData(
  count = 96,
  stepSize = STEP_SIZE,
  seed = 7,
  startPrice = 184.2
): ChartData[] {
  const endSequence = Math.floor(Date.now() / stepSize);
  const startSequence = endSequence - count;
  const data: ChartData[] = [];
  let close = startPrice;

  for (let index = 0; index < count; index++) {
    const sequence = startSequence + index;
    const open = close;
    close = open + marketChange(sequence, seed);
    const high = Math.max(open, close) + 0.42 + ((index + seed) % 5) * 0.09;
    const low = Math.min(open, close) - 0.38 - ((index + seed) % 7) * 0.065;

    data.push({
      time: sequence * stepSize,
      open: round(open),
      high: round(high),
      low: round(low),
      close: round(close),
      volume:
        780_000 +
        Math.round(Math.abs(close - open) * 620_000) +
        Math.round(seededUnit(sequence, seed, 23) * 210_000),
    });
  }

  return data;
}

export function nextMarketPoint(
  data: readonly ChartData[],
  stepSize = STEP_SIZE,
  seed = 7
): ChartData {
  const previous = data.at(-1)!;
  const open = previous.close ?? previous.open ?? 100;
  const sequence = Math.round(previous.time / stepSize) + 1;
  let change = marketChange(sequence, seed);

  const recentCloses = data
    .slice(-4)
    .map((point) => point.close ?? point.open ?? open);
  const falling = recentCloses.every(
    (value, index) => index === 0 || value < recentCloses[index - 1]!
  );
  const rising = recentCloses.every(
    (value, index) => index === 0 || value > recentCloses[index - 1]!
  );

  if (falling && change < 0) change = Math.abs(change) * 0.65 + 0.12;
  if (rising && change > 0) change = -Math.abs(change) * 0.45 - 0.06;

  const close = open + change;

  return {
    time: previous.time + stepSize,
    open: round(open),
    high: round(Math.max(open, close) + 0.44),
    low: round(Math.min(open, close) - 0.39),
    close: round(close),
    volume:
      820_000 +
      Math.round(Math.abs(change) * 680_000) +
      Math.round(seededUnit(sequence, seed, 23) * 180_000),
  };
}

function marketChange(sequence: number, seed: number) {
  const noise = (seededUnit(sequence, seed) - 0.5) * 0.74;
  const texture = (seededUnit(sequence, seed, 17) - 0.5) * 0.22;
  const momentum = Math.sin((sequence + seed * 13) / 10.5) * 0.11;
  const jumpChance = seededUnit(sequence, seed, 41);
  const jump =
    jumpChance > 0.975
      ? seededUnit(sequence, seed, 47) > 0.5
        ? 0.82
        : -0.68
      : 0;

  return 0.08 + noise + texture + momentum + jump;
}

function seededUnit(sequence: number, seed: number, salt = 0) {
  let value = (sequence ^ Math.imul(seed + salt, 0x9e3779b9)) | 0;
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return ((value ^ (value >>> 16)) >>> 0) / 4_294_967_296;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
