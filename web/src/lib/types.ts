export type Session = {
  id: string;
  size_x: number;
  size_y: number;
  size_z: number;
  mc_version: string;
  created_at: string;
  expires_at: string;
};

export type Block = {
  session_id: string;
  x: number;
  y: number;
  z: number;
  block_type: string;
  updated_at: string;
};

export type BlockKey = `${number},${number},${number}`;
export const blockKey = (x: number, y: number, z: number): BlockKey => `${x},${y},${z}`;
