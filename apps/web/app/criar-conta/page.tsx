'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, setToken } from '../../lib/api';
import { CopyButton } from '../../components/CopyButton';

interface Plano {
  id: string;
  slug: string;
  nome: string;
  tipoConta: 'infoprodutor' | 'corporativo';
  valorBase: string;
  alunosIncluidos: number | null;
  valorPorExcedente: string | null;
  limiteUsuarios: number | null;
}

interface SignupResult {
  email: string;
  valorTotal: number;
  metodo: 'pix' | 'boleto';
  pix: { pixCopiaECola?: string; imagemQrcode?: string } | null;
  boleto: { link?: string; pdf?: string; linhaDigitavel?: string } | null;
}

export default function CriarContaPage() {
  const router = useRouter();
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [planoId, setPlanoId] = useState('');
  const [marca, setMarca] = useState('');
  const [adminNome, setAdminNome] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [cupom, setCupom] = useState('');
  const [cupomOk, setCupomOk] = useState<string | null>(null);
  const [metodo, setMetodo] = useState<'pix' | 'boleto'>('pix');
  const [documento, setDocumento] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState<SignupResult | null>(null);
  const [ref, setRef] = useState('');

  useEffect(() => {
    api<Plano[]>('/public/planos-catalogo').then((ps) => { setPlanos(ps); if (ps[0]) setPlanoId(ps[0].id); }).catch(() => {});
    const r = new URLSearchParams(window.location.search).get('ref');
    if (r) setRef(r.trim().toUpperCase());
  }, []);

  const plano = planos.find((p) => p.id === planoId) || null;

  async function validarCupom() {
    if (!cupom.trim()) return;
    setCupomOk(null);
    try {
      await api('/public/validar-cupom', { method: 'POST', body: JSON.stringify({ codigo: cupom.trim(), tipoConta: plano?.tipoConta ?? null }) });
      setCupomOk('Cupom válido ✓');
    } catch (err) { setCupomOk(err instanceof Error ? err.message : 'Cupom inválido'); }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (!planoId) { setErro('Escolha um plano.'); return; }
    if (senha.length < 8) { setErro('A senha deve ter ao menos 8 caracteres.'); return; }
    if (metodo === 'boleto' && documento.replace(/\D/g, '').length < 11) { setErro('Informe um CPF ou CNPJ válido para o boleto.'); return; }
    setCarregando(true);
    try {
      const res = await api<SignupResult>('/public/signup-produtor', {
        method: 'POST',
        body: JSON.stringify({ marca, adminNome, adminEmail, senha, planoCatalogoId: planoId, cupom: cupom.trim() || undefined, ref: ref || undefined, metodo, documento: metodo === 'boleto' ? documento : undefined }),
      });
      setResultado(res);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível criar a conta');
    } finally {
      setCarregando(false);
    }
  }

  async function entrar() {
    try {
      const r = await api<{ accessToken: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email: adminEmail, senha }) });
      setToken(r.accessToken);
      router.push('/painel/dashboard');
    } catch { router.push('/login'); }
  }

  const inp = 'w-full ui-input dark:text-white mt-1';

  // Tela de sucesso: Pix + acesso ao painel
  if (resultado) {
    return (
      <main className="min-h-screen grid place-items-center bg-slate-100 dark:bg-slate-900 px-4 py-10">
        <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-7 space-y-4 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/40 grid place-items-center text-2xl">🎉</div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Conta criada!</h1>
          {resultado.valorTotal > 0 && resultado.metodo === 'pix' ? (
            <>
              <p className="text-sm text-slate-500 dark:text-slate-400">Pague o Pix abaixo para ativar a sua assinatura (R$ {resultado.valorTotal.toFixed(2)}).</p>
              {resultado.pix?.imagemQrcode && (
                <img src={resultado.pix.imagemQrcode} alt="QR Code Pix" className="w-44 h-44 mx-auto" />
              )}
              {resultado.pix?.pixCopiaECola ? (
                <div className="text-left text-sm bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">Pix copia-e-cola:</p>
                  <code className="block bg-white dark:bg-slate-800 border rounded p-2 break-all text-xs">{resultado.pix.pixCopiaECola}</code>
                  <div className="mt-2"><CopyButton texto={resultado.pix.pixCopiaECola} label="Copiar Pix" /></div>
                </div>
              ) : (
                <p className="text-xs text-amber-600">A cobrança Pix será enviada ao seu e-mail em instantes.</p>
              )}
            </>
          ) : resultado.valorTotal > 0 && resultado.metodo === 'boleto' ? (
            <>
              <p className="text-sm text-slate-500 dark:text-slate-400">Seu boleto de R$ {resultado.valorTotal.toFixed(2)} foi gerado. Após o pagamento (compensação em até 2 dias úteis) sua assinatura é ativada.</p>
              {resultado.boleto?.link && (
                <a href={resultado.boleto.link} target="_blank" rel="noopener noreferrer" className="inline-block bg-tribo-600 hover:bg-tribo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Abrir boleto</a>
              )}
              {resultado.boleto?.linhaDigitavel ? (
                <div className="text-left text-sm bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">Linha digitável:</p>
                  <code className="block bg-white dark:bg-slate-800 border rounded p-2 break-all text-xs">{resultado.boleto.linhaDigitavel}</code>
                  <div className="mt-2"><CopyButton texto={resultado.boleto.linhaDigitavel} label="Copiar código" /></div>
                </div>
              ) : (
                <p className="text-xs text-amber-600">O boleto será enviado ao seu e-mail em instantes.</p>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">Tudo certo — sua conta já está liberada.</p>
          )}
          <button onClick={entrar} className="w-full bg-tribo-600 hover:bg-tribo-700 text-white font-semibold py-2.5 rounded-lg text-sm transition">
            Ir para o painel
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen grid place-items-center bg-slate-100 dark:bg-slate-900 px-4 py-10">
      <form onSubmit={onSubmit} className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-7 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-tribo-600 grid place-items-center text-white font-bold">T</div>
          <span className="font-bold text-lg text-slate-900 dark:text-white">Tribo Hub</span>
        </div>
        <h1 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Comece agora</h1>

        {erro && <p className="text-sm bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-lg px-3 py-2">{erro}</p>}

        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400">Plano</label>
          <div className="grid gap-2 mt-1">
            {planos.length === 0 && <p className="text-sm text-slate-400">Carregando planos…</p>}
            {planos.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => setPlanoId(p.id)}
                className={`text-left border rounded-lg px-3 py-2 transition ${planoId === p.id ? 'border-tribo-500 ring-1 ring-tribo-500 bg-tribo-50 dark:bg-tribo-950/20' : 'border-slate-200 dark:border-slate-600'}`}
              >
                <div className="flex justify-between items-baseline">
                  <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">{p.nome}</span>
                  <span className="text-sm font-bold text-tribo-600">R$ {Number(p.valorBase).toFixed(2)}<span className="text-xs font-normal text-slate-400">/mês</span></span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {p.tipoConta === 'infoprodutor'
                    ? `${p.alunosIncluidos ?? 0} alunos inclusos${p.valorPorExcedente ? ` · R$ ${Number(p.valorPorExcedente).toFixed(2)}/aluno excedente` : ''}`
                    : `${p.limiteUsuarios ?? 0} assentos`}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400">Nome da sua marca / empresa</label>
          <input value={marca} onChange={(e) => setMarca(e.target.value)} required className={inp} />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400">Seu nome</label>
          <input value={adminNome} onChange={(e) => setAdminNome(e.target.value)} required className={inp} />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400">E-mail</label>
          <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required className={inp} />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400">Senha</label>
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required className={inp} />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400">Forma de pagamento</label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {(['pix', 'boleto'] as const).map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => setMetodo(m)}
                className={`border rounded-lg px-3 py-2 text-sm font-medium capitalize transition ${metodo === m ? 'border-tribo-500 ring-1 ring-tribo-500 bg-tribo-50 dark:bg-tribo-950/20 text-tribo-700 dark:text-tribo-300' : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}
              >
                {m === 'pix' ? 'Pix' : 'Boleto'}
              </button>
            ))}
          </div>
        </div>
        {metodo === 'boleto' && (
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400">CPF ou CNPJ (para o boleto)</label>
            <input value={documento} onChange={(e) => setDocumento(e.target.value)} className={inp} placeholder="somente números" />
          </div>
        )}
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400">Cupom (opcional)</label>
          <div className="flex gap-2 mt-1">
            <input value={cupom} onChange={(e) => { setCupom(e.target.value.toUpperCase()); setCupomOk(null); }} className="flex-1 ui-input dark:text-white" />
            <button type="button" onClick={validarCupom} className="text-sm px-3 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700">Aplicar</button>
          </div>
          {cupomOk && <p className={`text-[11px] mt-1 ${cupomOk.includes('✓') ? 'text-emerald-600' : 'text-rose-500'}`}>{cupomOk}</p>}
        </div>

        {ref && <p className="text-[11px] text-slate-400">Indicado por <span className="font-mono">{ref}</span></p>}

        <button type="submit" disabled={carregando} className="w-full bg-tribo-600 hover:bg-tribo-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm transition">
          {carregando ? 'Criando...' : 'Criar conta e pagar'}
        </button>
        <Link href="/login" className="block text-center text-sm text-slate-500 hover:text-tribo-600 dark:hover:text-tribo-400">
          Já tenho conta — entrar
        </Link>
      </form>
    </main>
  );
}
