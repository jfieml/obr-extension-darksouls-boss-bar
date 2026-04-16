export type GameStyle = "ds1" | "ds2" | "ds3" | "eldenring";

export interface BossBarData {
  bossName: string;
  currentHP: number;
  maxHP: number;
  gameStyle: GameStyle;
  scale: number;
}
