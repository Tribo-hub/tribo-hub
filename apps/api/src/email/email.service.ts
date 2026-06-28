import { Injectable, Logger } from '@nestjs/common';
import { env } from '@tribohub/config';

@Injectable()
export class EmailService {
  private readonly log = new Logger('EmailService');

  private async enviar(to: string, subject: string, html: string) {
    if (!env.RESEND_API_KEY) {
      this.log.warn(`[STUB e-mail] para ${to} — "${subject}" (defina RESEND_API_KEY p/ enviar de verdade)`);
      return { stub: true };
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, html }),
    });
    if (!res.ok) {
      const txt = await res.text();
      this.log.error(`Falha ao enviar e-mail (${res.status}): ${txt}`);
      throw new Error('Falha ao enviar e-mail');
    }
    return res.json();
  }

  private layout(titulo: string, corpo: string) {
    return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1e293b">
      <div style="font-size:20px;font-weight:bold;color:#7c3aed">Tribo Hub</div>
      <h1 style="font-size:18px">${titulo}</h1>
      ${corpo}
      <p style="color:#94a3b8;font-size:12px;margin-top:24px">Tribo Hub — plataforma de cursos</p>
    </div>`;
  }

  private botao(texto: string, url: string) {
    return `<p><a href="${url}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px">${texto}</a></p>
      <p style="color:#64748b;font-size:13px">ou copie o link: ${url}</p>`;
  }

  // Convite de colaborador (corporativo)
  async convite(to: string, nome: string, empresa: string, token: string) {
    const url = `${env.APP_URL}/aceitar-convite?token=${token}`;
    return this.enviar(
      to,
      `Convite para ${empresa} — Tribo Hub`,
      this.layout(
        `Você foi convidado para ${empresa}`,
        `<p>Olá ${nome}, ative sua conta definindo uma senha:</p>${this.botao('Ativar minha conta', url)}`,
      ),
    );
  }

  // Liberação de acesso (infoprodutor)
  async acessoLiberado(to: string, nome: string, curso: string, tokenAtivacao: string | null) {
    const corpo = tokenAtivacao
      ? `<p>Sua compra de <b>${curso}</b> foi confirmada! Defina sua senha para acessar:</p>${this.botao(
          'Acessar o curso',
          `${env.APP_URL}/aceitar-convite?token=${tokenAtivacao}`,
        )}`
      : `<p>Seu acesso a <b>${curso}</b> foi liberado.</p>${this.botao('Entrar', `${env.APP_URL}/login`)}`;
    return this.enviar(to, `Acesso liberado — ${curso}`, this.layout('Acesso liberado 🎉', corpo));
  }

  // Aviso de cobrança / ciclo de vida da fatura (Fase 1).
  async cobranca(to: string, titulo: string, corpo: string) {
    return this.enviar(to, `${titulo} — Tribo Hub`, this.layout(titulo, corpo));
  }

  // Recuperação de senha
  async recuperacaoSenha(to: string, nome: string, token: string) {
    const url = `${env.APP_URL}/redefinir-senha?token=${token}`;
    return this.enviar(
      to,
      'Redefinição de senha — Tribo Hub',
      this.layout(
        'Redefinir senha',
        `<p>Olá ${nome}, recebemos um pedido para redefinir sua senha. O link vale por 1 hora:</p>${this.botao(
          'Redefinir minha senha',
          url,
        )}<p style="color:#64748b;font-size:13px">Se você não pediu, ignore este e-mail.</p>`,
      ),
    );
  }

  // Teste de configuração
  async teste(to: string) {
    return this.enviar(to, 'Tribo Hub — teste de e-mail', this.layout('Funcionou! ✅', '<p>Integração de e-mail (Resend) ativa.</p>'));
  }
}
