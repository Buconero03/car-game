export enum GameState {
  MENU = 'MENU',
  RACING = 'RACING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER'
}

export interface CarStats {
  speed: number;
  maxSpeed: number;
  gear: number;
  damage: number;
  nitro: number; // 0 to 100
}

export interface CrewChiefMessage {
  text: string;
  emotion: 'neutral' | 'hype' | 'warning' | 'anger';
}