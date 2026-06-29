'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, ApiError, clearToken, getToken } from '../../../lib/api';
import { Shell } from '../../../components/Shell';
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

export default function AssinaturaPage() {
  const router = useRouter();
  const [info, setInfo] = useState<Assinatura | null>(null);
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

  const carregar = () =>
    api<Assinatura>('/painel/assinatura')
      .then(setInfo)
      .catch((err) => { if (err instanceof ApiError && (err.status === 401 || err.status === 403)) { clearToken(); router.replace('/login'); } });

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
          <p className="text-slate-500 dark:text-slate-400 text-sm">Valor mensal: <b>R$ {info.valorBase.toFixed(2)}</b></p>
        </div>

        {info.tipoConta !== 'corporativo' ? (
          <div className="ui-card p-5 text-sm text-slate-500 dark:text-slate-400">
            O cartão recorrente está disponível apenas para contas corporativas. Sua conta é cobrada por <b>Pix</b> ou <b>boleto</b> a cada ciclo.
          </div>
        ) : (
          <>
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
