// XP and levels, the same sum as on the server and in the old site: level n starts at 50·n·(n−1) XP.
export const xpForLevel = (level: number) => 50 * level * (level - 1);

const RANKS: [number, string][] = [[16, "Legend"], [12, "Champion"], [8, "Warrior"], [5, "Athlete"], [3, "Trainee"], [1, "Rookie"]];

export function levelOf(xp: number) {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  const start = xpForLevel(level), end = xpForLevel(level + 1);
  return { level, rank: RANKS.find(([from]) => level >= from)![1], into: xp - start, span: end - start, toNext: end - xp };
}
