// Registra o webhook Pix da Efí apontando para a nossa API (mTLS + OAuth).
// Uso: node scripts/efi-registrar-webhook.js [webhookUrlBase]
// Padrão: https://tribohub-production.up.railway.app/api/webhooks/efi  (a Efí adiciona /pix)
//
// Lê credenciais/certificado do .env da raiz. Não tem dependências externas.

const fs = require('fs');
const https = require('https');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function lerEnv() {
  const txt = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const env = {};
  for (const linha of txt.split(/\r?\n/)) {
    const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) {
      // remove comentário inline (" # ...") e aspas em volta
      const valor = m[2].replace(/\s+#.*$/, '').trim().replace(/^["']|["']$/g, '');
      env[m[1]] = valor;
    }
  }
  return env;
}

function req(host, agent, p, method, headers, body) {
  const data = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const r = https.request(
      {
        hostname: host,
        path: p,
        method,
        agent,
        headers: {
          ...headers,
          ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let b = '';
        res.on('data', (d) => (b += d));
        res.on('end', () => {
          let parsed;
          try { parsed = JSON.parse(b); } catch { parsed = b; }
          resolve({ status: res.statusCode, body: parsed });
        });
      },
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  const env = lerEnv();
  const sandbox = env.EFI_SANDBOX === 'true';
  const host = sandbox ? 'pix-h.api.efipay.com.br' : 'pix.api.efipay.com.br';
  const certPath = path.isAbsolute(env.EFI_CERTIFICATE_PATH)
    ? env.EFI_CERTIFICATE_PATH
    : path.resolve(ROOT, env.EFI_CERTIFICATE_PATH);
  const pfx = fs.readFileSync(certPath);
  const agent = new https.Agent({ pfx, passphrase: '' });

  const webhookBase = process.argv[2] || 'https://tribohub-production.up.railway.app/api/webhooks/efi';
  const chave = env.EFI_PIX_KEY;

  console.log(`Ambiente: ${sandbox ? 'HOMOLOGAÇÃO' : 'PRODUÇÃO'} (${host})`);
  console.log(`Chave Pix: ${chave}`);
  console.log(`Webhook:   ${webhookBase}  (a Efí chamará ${webhookBase}/pix)`);

  // 1) OAuth
  const basic = Buffer.from(`${env.EFI_CLIENT_ID}:${env.EFI_CLIENT_SECRET}`).toString('base64');
  const auth = await req(host, agent, '/oauth/token', 'POST', { Authorization: `Basic ${basic}` }, { grant_type: 'client_credentials' });
  if (auth.status >= 300 || !auth.body.access_token) {
    console.error('❌ Falha no OAuth:', auth.status, auth.body);
    process.exit(1);
  }
  const token = auth.body.access_token;
  console.log('✅ OAuth OK');

  // 2) Registra o webhook (x-skip-mtls-checking: nosso endpoint não exige mTLS de entrada)
  const put = await req(
    host,
    agent,
    `/v2/webhook/${chave}`,
    'PUT',
    { Authorization: `Bearer ${token}`, 'x-skip-mtls-checking': 'true' },
    { webhookUrl: webhookBase },
  );
  console.log(`PUT /v2/webhook/${chave} ->`, put.status, JSON.stringify(put.body));

  // 3) Confirma
  const get = await req(host, agent, `/v2/webhook/${chave}`, 'GET', { Authorization: `Bearer ${token}` });
  console.log(`GET /v2/webhook/${chave} ->`, get.status, JSON.stringify(get.body));

  if (put.status < 300) console.log('\n✅ Webhook registrado com sucesso.');
  else console.log('\n⚠️ Verifique o erro acima.');
}

main().catch((e) => {
  console.error('Erro:', e.message);
  process.exit(1);
});
