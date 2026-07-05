'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';
import { Shell } from '../../../components/Shell';
import { CopyButton } from '../../../components/CopyButton';
import { Badge } from '../../../components/ui/Badge';
import { toast } from '../../../lib/toast';

const PAYEE = process.env.NEXT_PUBLIC_EFI_PAYEE_CODE || '062bc92084e2302eaa8463cf018ec2fe';
const EFI_ENV: 'production' | 'sandbox' = (process.env.NEXT_PUBLIC_EFI_ENV as 'production' | 'sandbox') || 'production';

interface Assinatura {
  tipoConta: 'infoprodutor' | 'corporativo';
  valorBase: number;
  metodoPreferido: string | null;
  cartaoMascara: string | null;
  temCartao: boolean;
}
interface FaturaAberta {
  id: string; competencia: string; valorTotal: string; status: string; vencimentoEm: string | null;
  pixCopiaECola: string | null; boletoUrl: string | null; boletoLinhaDigitavel: string | null; metodoPagamento: string | null;
}
interface FaturaHist {
  id: string; competencia: string; valorTotal: string; status: string;
  vencimentoEm: string | null; pagoEm: string | null; metodoPagamento: string | null; avulsa: boolean; observacao: string | null;
}

const TOM_STATUS: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  paga: 'success', pendente: 'warning', vencida: 'danger', cancelada: 'neutral',
};

export default function AssinaturaPage() {
  const router = useRouter();
  const [info, setInfo] = useState<Assinatura | null>(null);
  const [aberta, setAberta] = useState<FaturaAberta | null>(null);
  const [faturas, setFaturas] = useState<FaturaHist[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  // cartão
  const [numero, setNumero] = useState('');
  const [mes, setMes] = useState('');
  const [ano, setAno] = useState('');
  const [cvv, setCvv] = useState('');
  const [titular, setTitular] = useState('');
  const [cpf, setCpf] = useState('');
  // cliente
  const [email, setEmail] = useState('');
  const [nascimento, setNascimento] = useState('');
  const [telefone, setTelefone] = useState('');
  // endereço de cobrança
  const [cep, setCep] = useState('');
  const [rua, setRua] = useState('');
  const [num, setNum] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [complemento, setComplemento] = useState('');

  const carregar = () => {
    api<Assinatura>('/painel/assinatura')
      .then(setInfo)
      .catch((err) => { if (err instanceof ApiError && (err.status === 401 || err.status === 403)) { clearToken(); router.replace('/login'); } });
    api<FaturaAberta | null>('/painel/minha-fatura-aberta').then(setAberta).catch(() => {});
    api<FaturaHist[]>('/painel/minhas-faturas').then(setFaturas).catch(() => {});
  };

  useEffect(() => { if (!getToken()) { router.replace('/login'); return; } carregar(); }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (cpf.replace(/\D/g, '').length !== 11) { setErro('CPF do titular inválido.'); return; }
    setSalvando(true);
    try {
      const mod = await import('payment-token-efi');
      const EfiPay = mod.default;
      const numeroLimpo = numero.replace(/\D/g, '');

      const brand = await EfiPay.CreditCard.setAccount(PAYEE).setEnvironment(EFI_ENV).setCardNumber(numeroLimpo).verifyCardBrand();
      if (typeof brand !== 'string' || !brand || brand === 'undefined') { setErro('Não reconhecemos a bandeira do cartão. Confira o número.'); setSalvando(false); return; }

      const resp = await EfiPay.CreditCard
        .setAccount(PAYEE)
        .setEnvironment(EFI_ENV)
        .setCreditCardData({
          brand,
          number: numeroLimpo,
          cvv: cvv.trim(),
          expirationMonth: mes.padStart(2, '0'),
          expirationYear: ano.length === 2 ? `20${ano}` : ano,
          holderName: titular.trim(),
          holderDocument: cpf.replace(/\D/g, ''),
          reuse: false,
        })
        .getPaymentToken();

      if (!('payment_token' in resp)) {
        setErro(resp.error_description || 'Falha ao validar o cartão.');
        setSalvando(false);
        return;
      }

      await api('/painel/assinatura/cartao', {
        method: 'POST',
        body: JSON.stringify({
          paymentToken: resp.payment_token,
          customer: { nome: titular.trim(), cpf: cpf.replace(/\D/g, ''), email: email.trim(), nascimento, telefone: telefone || undefined },
          endereco: { rua: rua.trim(), numero: num.trim(), bairro: bairro.trim(), cep: cep.replace(/\D/g, ''), cidade: cidade.trim(), estado: estado.trim().toUpperCase(), complemento: complemento.trim() || undefined },
        }),
      });
      toast.success('Cartão cadastrado! A assinatura recorrente está ativa.');
      setNumero(''); setCvv(''); setMes(''); setAno('');
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível cadastrar o cartão.');
    } finally {
      setSalvando(false);
    }
  }

  const inp = 'w-full mt-1 ui-input dark:text-white';

  if (!info) return <Shell area="painel"><div className="p-6 text-slate-400">Carregando…</div></Shell>;

  return (
    <Shell area="painel">
      <div className="p-6 max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Assinatura</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Valor base mensal: <b>R$ {info.valorBase.toFixed(2)}</b>
            {info.temCartao && info.cartaoMascara ? <> · cartão <span className="font-mono">{info.cartaoMascara}</span></> : null}
          </p>
        </div>

        {/* Fatura em aberto (pagar proativamente) */}
        <div className="ui-card p-5 space-y-3">
          <h2 className="font-semibold">Fatura em aberto</h2>
          {!aberta ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">✓ Nenhuma fatura em aberto. Tudo em dia!</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium">{aberta.competencia}</span>
                <span className="font-bold">R$ {Number(aberta.valorTotal).toFixed(2)}</span>
                <Badge tom={TOM_STATUS[aberta.status] ?? 'neutral'}>{aberta.status}</Badge>
                {aberta.vencimentoEm && <span className="text-xs text-slate-400">vence {new Date(aberta.vencimentoEm).toLocaleDateString('pt-BR')}</span>}
              </div>
              {aberta.pixCopiaECola && (
                <div className="text-sm bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">Pix copia-e-cola:</p>
                  <code className="block bg-white dark:bg-slate-800 border rounded p-2 break-all text-xs">{aberta.pixCopiaECola}</code>
                  <div className="mt-2"><CopyButton texto={aberta.pixCopiaECola} label="Copiar Pix" /></div>
                </div>
              )}
              {aberta.boletoUrl && (
                <a href={aberta.boletoUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-sm text-tribo-600 dark:text-tribo-400 underline">Abrir boleto</a>
              )}
              {aberta.boletoLinhaDigitavel && (
                <div className="text-sm bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">Linha digitável:</p>
                  <code className="block bg-white dark:bg-slate-800 border rounded p-2 break-all text-xs">{aberta.boletoLinhaDigitavel}</code>
                  <div className="mt-2"><CopyButton texto={aberta.boletoLinhaDigitavel} label="Copiar código" /></div>
                </div>
              )}
              {!aberta.pixCopiaECola && !aberta.boletoUrl && (
                <p className="text-xs text-amber-600">A cobrança está sendo gerada — atualize em instantes ou aguarde o e-mail.</p>
              )}
            </>
          )}
        </div>

        {/* Histórico de faturas */}
        <div className="ui-card overflow-hidden">
          <h2 className="font-semibold px-5 py-3 border-b border-slate-100 dark:border-slate-700">Histórico de faturas</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/40">
              <tr><th className="px-4 py-2 font-medium">Competência</th><th className="px-4 py-2 font-medium">Valor</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">Pago em</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {faturas.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">Nenhuma fatura ainda.</td></tr>
              ) : faturas.map((f) => (
                <tr key={f.id}>
                  <td className="px-4 py-3">{f.competencia}{f.avulsa && <span className="text-xs text-slate-400"> · avulsa</span>}</td>
                  <td className="px-4 py-3">R$ {Number(f.valorTotal).toFixed(2)}</td>
                  <td className="px-4 py-3"><Badge tom={TOM_STATUS[f.status] ?? 'neutral'}>{f.status}</Badge></td>
                  <td className="px-4 py-3 text-xs text-slate-400">{f.pagoEm ? new Date(f.pagoEm).toLocaleDateString('pt-BR') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {info.tipoConta === 'corporativo' && (
          <>
            <h2 className="font-semibold">Cartão recorrente</h2>
            {info.temCartao && (
              <div className="ui-card p-4 text-sm border-l-4 border-emerald-500">
                Cartão recorrente ativo {info.cartaoMascara ? <>· <span className="font-mono">{info.cartaoMascara}</span></> : null}. Você pode cadastrar outro cartão abaixo para substituir.
              </div>
            )}

            <form onSubmit={onSubmit} className="ui-card p-5 space-y-4">
              {erro && <p className="text-sm bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-lg px-3 py-2">{erro}</p>}

              <div>
                <h2 className="font-semibold text-sm mb-2">Cartão</h2>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <label className="block sm:col-span-2">Número do cartão<input value={numero} onChange={(e) => setNumero(e.target.value)} inputMode="numeric" autoComplete="cc-number" className={inp} /></label>
                  <label className="block">Validade (mês)<input value={mes} onChange={(e) => setMes(e.target.value)} placeholder="MM" inputMode="numeric" className={inp} /></label>
                  <label className="block">Validade (ano)<input value={ano} onChange={(e) => setAno(e.target.value)} placeholder="AAAA" inputMode="numeric" className={inp} /></label>
                  <label className="block">CVV<input value={cvv} onChange={(e) => setCvv(e.target.value)} inputMode="numeric" autoComplete="cc-csc" className={inp} /></label>
                  <label className="block">Nome impresso no cartão<input value={titular} onChange={(e) => setTitular(e.target.value)} autoComplete="cc-name" className={inp} /></label>
                  <label className="block sm:col-span-2">CPF do titular<input value={cpf} onChange={(e) => setCpf(e.target.value)} inputMode="numeric" className={inp} /></label>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
                <h2 className="font-semibold text-sm mb-2">Dados do titular</h2>
                <div className="grid sm:grid-cols-3 gap-3 text-sm">
                  <label className="block">E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inp} /></label>
                  <label className="block">Nascimento<input type="date" value={nascimento} onChange={(e) => setNascimento(e.target.value)} className={inp} /></label>
                  <label className="block">Telefone<input value={telefone} onChange={(e) => setTelefone(e.target.value)} inputMode="numeric" className={inp} /></label>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
                <h2 className="font-semibold text-sm mb-2">Endereço de cobrança</h2>
                <div className="grid sm:grid-cols-6 gap-3 text-sm">
                  <label className="block sm:col-span-2">CEP<input value={cep} onChange={(e) => setCep(e.target.value)} inputMode="numeric" className={inp} /></label>
                  <label className="block sm:col-span-3">Rua<input value={rua} onChange={(e) => setRua(e.target.value)} className={inp} /></label>
                  <label className="block">Número<input value={num} onChange={(e) => setNum(e.target.value)} className={inp} /></label>
                  <label className="block sm:col-span-2">Bairro<input value={bairro} onChange={(e) => setBairro(e.target.value)} className={inp} /></label>
                  <label className="block sm:col-span-2">Cidade<input value={cidade} onChange={(e) => setCidade(e.target.value)} className={inp} /></label>
                  <label className="block">UF<input value={estado} onChange={(e) => setEstado(e.target.value)} maxLength={2} className={inp} /></label>
                  <label className="block sm:col-span-6">Complemento (opcional)<input value={complemento} onChange={(e) => setComplemento(e.target.value)} className={inp} /></label>
                </div>
              </div>

              <button disabled={salvando} className="bg-tribo-600 hover:bg-tribo-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                {salvando ? 'Processando…' : 'Cadastrar cartão recorrente'}
              </button>
              <p className="text-[11px] text-slate-400">Os dados do cartão são enviados com segurança direto à Efí (não passam pelo nosso servidor).</p>
            </form>
          </>
        )}
      </div>
    </Shell>
  );
}
