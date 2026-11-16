import { useState } from 'react';
import { type User } from 'firebase/auth';
import { ArrowRight } from 'lucide-react';
import { signInWithGoogle } from '../lib/firebase';

interface AuthGateProps {
  onEnterTestMode?: () => void;
  onGoogleLogin?: (user: User) => void;
}

export function AuthGate({ onEnterTestMode, onGoogleLogin }: AuthGateProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);

  async function handleLogin() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const loggedUser = await signInWithGoogle();
      onGoogleLogin?.(loggedUser);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao autenticar com o Google.';
      if (msg.includes('popup-closed-by-user')) {
        setErrorMsg('A janela de login foi fechada antes da conclusão.');
      } else {
        setErrorMsg('Não foi possível entrar com o Google. Você pode usar o modo teste abaixo.');
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
          {/* Logo Arames Brasil em destaque sobre fundo branco */}
          <div className="flex flex-col items-center text-center">
            {!logoError ? (
              <img
                src={`${import.meta.env.BASE_URL}logo-arames-brasil.jpg`}
                alt="Arames Brasil — Ferro e Aço para Construção Civil"
                referrerPolicy="no-referrer"
                onError={() => setLogoError(true)}
                className="w-full max-w-[280px] sm:max-w-[300px] h-auto object-contain select-none"
              />
            ) : (
              <div className="py-3 text-center">
                <span className="font-display text-2xl font-bold tracking-tight text-slate-900">
                  ARAMES <span className="text-red-600">BRASIL</span>
                </span>
              </div>
            )}

            <div className="w-12 h-0.5 bg-red-600/80 rounded-full mt-5 mb-5" aria-hidden="true" />

            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
              AçoGestão
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Controle de Estoque Mensal
            </p>
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

            {onEnterTestMode && (
              <>
                <div className="flex items-center gap-3 py-1" aria-hidden="true">
                  <div className="h-px bg-slate-200 flex-1" />
                  <span className="text-[11px] font-medium text-slate-400">ou</span>
                  <div className="h-px bg-slate-200 flex-1" />
                </div>

                <button
                  type="button"
                  onClick={onEnterTestMode}
                  disabled={loading}
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 disabled:opacity-60 text-slate-700 text-sm font-medium flex items-center justify-center transition-colors duration-150 cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
                >
                  <span>Entrar no modo teste</span>
                </button>
              </>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-slate-400 leading-relaxed">
            Use aramesprojeto@gmail.com para acessar o estoque oficial. No modo teste, os dados ficam apenas neste navegador e não são sincronizados.
          </p>
        </div>

        <footer className="mt-5 text-center text-xs text-slate-400">
          Arames Brasil · Controle de Estoque
        </footer>
      </main>
    </div>
  );
}
