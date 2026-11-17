import { useState } from 'react';
import type { User } from 'firebase/auth';
import { createLinkedPassword } from '../lib/firebase';

export function CreatePassword({ user, onClose }: { user: User; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage('');
    if (password.length < 8) { setMessage('Escolha uma senha com pelo menos 8 caracteres.'); return; }
    if (password !== confirmation) { setMessage('As senhas não coincidem.'); return; }
    setLoading(true);
    try {
      await createLinkedPassword(user, password);
      setPassword(''); setConfirmation(''); setSuccess(true);
      setMessage('Senha criada e vinculada à sua conta. Você pode continuar usando o Google.');
    } catch (err) {
      const code = (err as { code?: string })?.code;
      setMessage(code === 'auth/provider-already-linked' ? 'Esta conta já tem uma senha vinculada. Para alterá-la, use Esqueci minha senha na tela de acesso.' : 'Não foi possível criar a senha. Confirme a conta Google e tente novamente.');
    } finally { setLoading(false); }
  }
  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="password-title">
      <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl space-y-4">
        <h2 id="password-title" className="text-lg font-semibold">Criar senha de acesso</h2>
        <p className="text-sm text-slate-600">A senha será vinculada a aramesprojeto@gmail.com. Confirme a conta Google quando solicitado. O acesso pelo Google continua funcionando.</p>
        {message && <p role="status" className={`text-sm ${success ? 'text-green-700' : 'text-red-700'}`}>{message}</p>}
        {!success && <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm">Nova senha<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required minLength={8} className="mt-1 w-full h-11 border border-slate-300 rounded-lg px-3" /></label>
          <label className="block text-sm">Confirmar senha<input type="password" value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="new-password" required minLength={8} className="mt-1 w-full h-11 border border-slate-300 rounded-lg px-3" /></label>
          <button disabled={loading} type="submit" className="w-full h-11 rounded-lg bg-red-700 text-white disabled:opacity-60">{loading ? 'Criando...' : 'Confirmar conta e criar senha'}</button>
        </form>}
        <button type="button" disabled={loading} onClick={onClose} className="w-full h-10 rounded-lg border border-slate-300">{success ? 'Concluir' : 'Cancelar'}</button>
      </div>
    </div>
  );
}
