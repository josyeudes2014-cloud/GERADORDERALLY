export type TribeDefinition = {
  id: string;
  name: string;
  symbol: string;
  accent: string;
  description: string;
  logo: string;
};

export const TRIBES: TribeDefinition[] = [
  { id: 'aser', name: 'Aser', symbol: '🌿', accent: '#16a34a', description: 'Frutificação e abundância', logo: '/tribes/aser.svg' },
  { id: 'benjamin', name: 'Benjamin', symbol: '🐺', accent: '#475569', description: 'Coragem e prontidão', logo: '/tribes/benjamin.svg' },
  { id: 'efraim', name: 'Efraim', symbol: '🐂', accent: '#2563eb', description: 'Força e crescimento', logo: '/tribes/efraim.svg' },
  { id: 'gade', name: 'Gade', symbol: '🛡️', accent: '#b45309', description: 'Batalha e perseverança', logo: '/tribes/gade.svg' },
  { id: 'issacar', name: 'Issacar', symbol: '☀️', accent: '#d97706', description: 'Discernimento e serviço', logo: '/tribes/issacar.svg' },
  { id: 'juda', name: 'Judá', symbol: '🦁', accent: '#dc2626', description: 'Liderança e louvor', logo: '/tribes/juda.svg' },
  { id: 'levi', name: 'Levi', symbol: '🔥', accent: '#7c3aed', description: 'Serviço e consagração', logo: '/tribes/levi.svg' },
  { id: 'manasses', name: 'Manassés', symbol: '🌾', accent: '#0f766e', description: 'Superação e recomeço', logo: '/tribes/manasses.svg' },
  { id: 'naftali', name: 'Naftali', symbol: '🦌', accent: '#0891b2', description: 'Liberdade e agilidade', logo: '/tribes/naftali.svg' },
  { id: 'rubens', name: 'Rubens', symbol: '🌊', accent: '#0369a1', description: 'Primogenitura e responsabilidade', logo: '/tribes/rubens.svg' },
  { id: 'simeao', name: 'Simeão', symbol: '⚔️', accent: '#9333ea', description: 'Zelo e intensidade', logo: '/tribes/simeao.svg' },
  { id: 'zebulom', name: 'Zebulom', symbol: '⛵', accent: '#0284c7', description: 'Expansão e movimento', logo: '/tribes/zebulom.svg' }
];

export const tribeById = (id: string) => TRIBES.find((tribe) => tribe.id === id);
