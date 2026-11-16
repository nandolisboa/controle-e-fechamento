import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { signInWithGoogle } from '../lib/firebase';

export function AuthGate() {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rememberUser, setRememberUser] = useState(() => {
    try { return window.localStorage.getItem('acogestao_lembrar_usuario') !== 'false'; }
    catch { return true; }
  });

  async function handleLogin() {
    setLoading(true);
    setErrorMsg(null);
    try {
      try { window.localStorage.setItem('acogestao_lembrar_usuario', String(rememberUser)); } catch { /* persistence choice still applies */ }
      await signInWithGoogle(rememberUser);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao autenticar com o Google.';
      if (msg.includes('popup-closed-by-user')) {
        setErrorMsg('A janela de login foi fechada antes da conclusão.');
      } else {
        setErrorMsg('Não foi possível entrar com o Google. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-slate-900 flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Fundo geométrico sutil em tons de aço */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 0%, rgba(220, 38, 38, 0.06), transparent 50%), linear-gradient(to right, rgba(15, 23, 42, 0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(15, 23, 42, 0.035) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 40px 40px, 40px 40px',
        }}
      />

      <main className="relative z-10 w-full max-w-[420px]">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-[0_16px_44px_-16px_rgba(15,23,42,0.12)] px-7 py-8 sm:px-9 sm:py-10">
          <div className="flex flex-col items-center text-center">
            <div className="py-3 text-center font-display text-2xl font-bold tracking-tight text-slate-900">
              ARAMES <span className="text-red-600">BRASIL</span>
            </div>
            <div className="w-12 h-0.5 bg-red-600/80 rounded-full mt-5 mb-5" aria-hidden="true" />
          </div>

          <div className="mt-8 space-y-3">
            {errorMsg && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 leading-relaxed"
              >
                {errorMsg}
              </div>
            )}

            <label className="flex items-center gap-2.5 px-1 text-sm text-slate-600 cursor-pointer select-none">
              <input type="checkbox" checked={rememberUser} onChange={(event) => setRememberUser(event.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-red-600 focus:ring-2 focus:ring-red-600/20" />
              <span>Lembrar usuário</span>
            </label>

            <button
              type="button"
              onClick={handleLogin}
              disabled={loading}
              className="w-full h-11 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 disabled:opacity-60 text-white text-sm font-medium flex items-center justify-center gap-2.5 transition-colors duration-150 cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="w-4 h-4 shrink-0"
              >
                <path
                  fill="#EA4335"
                  d="M12 5.04c1.64 0 3.12.56 4.28 1.66l3.2-3.2C17.53 1.68 14.98.6 12 .6 7.45.6 3.52 3.21 1.61 7.01l3.73 2.9C6.24 7.12 8.88 5.04 12 5.04z"
                />
                <path
                  fill="#4285F4"
                  d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.72 2.89c2.17-2 3.7-4.96 3.7-8.71z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.34 14.09a6.94 6.94 0 0 1 0-4.18l-3.73-2.9A11.96 11.96 0 0 0 .4 12c0 1.93.46 3.75 1.21 5.39l3.73-3.3z"
                />
                <path
                  fill="#34A853"
                  d="M12 23.4c3.24 0 5.95-1.08 7.93-2.91l-3.72-2.89c-1.07.72-2.45 1.15-4.21 1.15-3.12 0-5.76-2.08-6.7-4.88l-3.69 2.9C3.52 20.79 7.45 23.4 12 23.4z"
                />
              </svg>
              <span>{loading ? 'Conectando...' : 'Entrar com Google'}</span>
              <ArrowRight className="w-4 h-4 shrink-0 opacity-75" />
            </button>


          </div>

        </div>

      </main>
    </div>
  );
}
