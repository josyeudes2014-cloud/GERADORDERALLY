import { tribeById } from '../data/tribes';

export default function TribeLogo({ tribeId, size = 48 }: { tribeId: string; size?: number }) {
  const tribe = tribeById(tribeId);
  if (!tribe) return <span className="tribe-fallback">?</span>;
  return <img src={tribe.logo} alt={`Tribo ${tribe.name}`} width={size} height={size} className="tribe-logo" />;
}
