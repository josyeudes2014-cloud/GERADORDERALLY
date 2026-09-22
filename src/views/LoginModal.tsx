import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { signIn } from '../lib/remote';

export default function LoginModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(''); try { await signIn(email, password); onSuccess(); } catch { setError('Não foi possível entrar. Confira o e-mail e a senha.'); } finally { setBusy(false); } };
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="login-modal" role="dialog" aria-modal="true" aria-labelledby="login-title" onMouseDown={(e) => e.stopPropagation()}><button className="icon-button modal-close" onClick={onClose} aria-label="Fechar login"><X /></button><div className="login-brand"><span>R</span></div><span className="eyebrow">Área administrativa</span><h2 id="login-title">Entre no Rally</h2><p>Administradores e líderes usam o mesmo acesso. As permissões são aplicadas pelo Supabase Auth.</p><form onSubmit={submit}><label><span>E-mail</span><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></label><label><span>Senha</span><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>{error ? <div className="login-error" role="alert">{error}</div> : null}<button className="button primary full" disabled={busy}>{busy ? 'Entrando...' : 'Entrar no painel'}</button></form></div></div>;
}
