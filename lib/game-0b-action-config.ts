import {
  Pickaxe,
  Wrench,
  ScanSearch,
  ShieldAlert,
  Eye,
  Sword,
  Ghost,
  Flame,
  Banknote,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ActionConfig = {
  icon: LucideIcon;
  color: string;
};

export const ACTION_CONFIG: Record<string, ActionConfig> = {
  mine:            { icon: Pickaxe,     color: '#F59E0B' },
  repair:          { icon: Wrench,      color: '#22C55E' },
  repair_survivor: { icon: Wrench,      color: '#22C55E' },
  repair_rebel:    { icon: Wrench,      color: '#22C55E' },
  search:          { icon: ScanSearch,  color: '#3B82F6' },
  control:         { icon: ShieldAlert, color: '#8B5CF6' },
  detect:          { icon: Eye,         color: '#06B6D4' },
  assassinate:     { icon: Sword,       color: '#EF4444' },
  plunder:         { icon: Ghost,       color: '#F97316' },
  destroy:         { icon: Flame,       color: '#DC2626' },
  hidden_trade:    { icon: Banknote,    color: '#94A3B8' },
  skip:            { icon: X,           color: '#4B5563' },
  none:            { icon: X,           color: '#4B5563' },
};
