import { useState } from 'react';
import { ArrowRight, Layers, Scale, ShieldCheck } from 'lucide-react';
import { signInWithGoogle } from '../lib/firebase';

export function AuthGate() {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleLogin() {
    setLoading(true);
    setErrorMsg(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao autenticar com o Google.';
      if (msg.includes('popup-closed-by-user')) {
        setErrorMsg('A janela de login foi fechada antes da conclusão.');
      } else {
        setErrorMsg('Não foi possível entrar. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-slate-900 flex flex-col justify-between">
      <header className="w-full border-b border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            AçoGestão
          </span>
          <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
            Controle de Estoque Mensal
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-7 flex flex-col justify-center">
            <p className="text-xs font-medium text-orange-600 mb-3">
              Inventário Mensal de Armação &amp; Ferro
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-[1.15] [text-wrap:balance]">
              Controle preciso do estoque mensal por bitola, unidade e peso.
            </h1>
            <p className="mt-4 text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
              Organize a contagem mensal de estribos, bobinas, barras, telas pop e arames com registro de etiquetas, pesagem em balança e fechamento de período.
            </p>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-slate-200">
              <div>
                <div className="flex items-center gap-2 text-slate-900 font-medium text-sm">
                  <Layers className="w-4 h-4 text-orange-600 shrink-0" />
                  <span>5 Categorias</span>
                </div>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Estribo, Bobinas, Barras, Telas Pop e Arames Liso/Torcido.
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-slate-900 font-medium text-sm">
                  <Scale className="w-4 h-4 text-orange-600 shrink-0" />
                  <span>Etiqueta &amp; Balança</span>
                </div>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Conferência dedicada para lotes de barras com etiqueta e peso real.
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-slate-900 font-medium text-sm">
                  <ShieldCheck className="w-4 h-4 text-orange-600 shrink-0" />
                  <span>Fechamento Mensal</span>
                </div>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Histórico salvo na nuvem, cópia do mês anterior e exportação CSV.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-8 flex flex-col justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold text-slate-900">
                Acessar painel de estoque
              </h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Entre com sua conta Google para criar e acompanhar suas contagens mensais em qualquer dispositivo.
              </p>
            </div>

            <div className="mt-8">
              {errorMsg && (
                <div
                  role="alert"
                  className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700"
                >
                  {errorMsg}
                </div>
              )}

              <button
                type="button"
                onClick={handleLogin}
                disabled={loading}
                className="w-full h-11 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-medium flex items-center justify-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>{loading ? 'Conectando...' : 'Entrar com Google'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <p className="mt-4 text-xs text-slate-500 leading-relaxed">
                Seus lançamentos ficam vinculados exclusivamente à sua conta autenticada.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between text-xs text-slate-500">
          <span>AçoGestão</span>
          <span>Planilha mensal · Corte, Dobra e Armazenagem</span>
        </div>
      </footer>
    </div>
  );
}
