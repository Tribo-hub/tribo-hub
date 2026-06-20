# TRIBO HUB — Especificação Técnica v4.0

**Plataforma SaaS bimodal de educação e área de membros**
Marca: **Tribo** · Domínio: `tribohub.com.br`
Responsável: Lucas Silveira · Junho 2026
Classificação: Confidencial — Uso interno e desenvolvimento

> **Documento de referência para desenvolvimento.** Substitui integralmente a especificação anterior (v3 "Doctum Corporativo"). O modelo de dados em nível de campo é definido de forma autoritativa em [`schema.prisma`](schema.prisma); este documento descreve produto, regras de negócio, módulos e endpoints.

---

## 1. Visão Geral

O **Tribo Hub** é uma plataforma SaaS **multi-tenant** que entrega, sobre a mesma base, **dois modos de operação**:

- **Modo Corporativo (B2B):** empresas que querem formar seus colaboradores. O **conteúdo é da plataforma** (catálogo produzido por nós), atribuído às empresas contratantes.
- **Modo Infoprodutor (B2B2C):** criadores de cursos que hoje vendem em Hotmart/Eduzz/Kiwify e precisam de uma **área de membros** própria. O **conteúdo é do próprio infoprodutor**; a venda continua no checkout externo e o Tribo Hub **libera/revoga acesso via webhook**.

**Posicionamento:** não é uma biblioteca de cursos nem um LMS tradicional. É um sistema de **desenvolvimento contínuo** (corporativo) e uma **área de membros moderna** (infoprodutor), com experiência padrão streaming, trilhas orientadas a resultado e gestão clara.

### 1.1 Públicos-alvo (ICP)

| Modo | Perfil | Conteúdo | Quem paga você | Aquisição do usuário final |
|---|---|---|---|---|
| Corporativo | Empresas de 10 a 300 colaboradores | Da plataforma (você produz) | A empresa (assinatura por assentos) | Convite do gestor |
| Infoprodutor | Criadores que vendem em Hotmart/Eduzz/Kiwify | Do próprio infoprodutor | O infoprodutor (base + por aluno excedente) | Compra externa → acesso automático |

---

## 2. Os Dois Modos de Operação (núcleo do produto)

O comportamento do sistema **ramifica a partir do `tipo_conta`** de cada tenant.

| Eixo | Corporativo | Infoprodutor |
|---|---|---|
| `tipo_conta` | `corporativo` | `infoprodutor` |
| Dono do conteúdo | Plataforma (global) | O tenant (isolado por conta) |
| Quem cria conteúdo | Super Admin | O próprio produtor (admin do tenant) |
| Usuário final | Colaborador | Aluno/comprador |
| Como ganha acesso | Convite (limite de assentos) | Matrícula gerada na compra (com prazo) |
| Cadastro do usuário | Por convite | Auto-provisionado no webhook / auto-cadastro |
| Pagamento do usuário final | — | No checkout externo (Hotmart etc.) |
| Sua cobrança | Assentos por plano | `valor_base` + excedente por aluno ativo |
| Dashboard | Engajamento da equipe | Alunos, acessos, conclusão, (vendas) |

> **Regra crítica de isolamento:** toda query **DEVE** filtrar por `conta_id`. Para o modo infoprodutor isso vale também para **conteúdo** — um infoprodutor jamais pode ver/usar trilhas, alunos ou métricas de outro. Sem exceção.

---

## 3. Arquitetura

### 3.1 Modelo

Aplicação única, **multi-tenant**, com isolamento lógico por `conta_id` em todas as queries. Middleware de tenant injeta `conta_id` em toda requisição autenticada.

### 3.2 Resolução de tenant por host

Cada conta tem um **subdomínio** (`cliente.tribohub.com.br`) e, opcionalmente, **domínio próprio** (`area.cursodele.com` — relevante para infoprodutores). O tenant é resolvido pelo host da requisição. O Super Admin opera em `admin.tribohub.com.br`.

Instâncias lógicas de acesso:

```
tribohub.com.br
  /admin     → Super Admin (operação da plataforma)
  /painel    → Admin do tenant (gestor corporativo OU produtor infoprodutor)
  /app       → Usuário final (colaborador OU aluno)
```

### 3.3 Stack tecnológica

| Camada | Tecnologia | Observação |
|---|---|---|
| Frontend | Next.js 14+ (App Router) + React + Tailwind | Mobile-first, SSR |
| Backend | Node.js + NestJS | REST + JWT |
| Banco | PostgreSQL | Isolamento por `conta_id` |
| ORM | Prisma | Migrations versionadas — ver `schema.prisma` |
| Storage | AWS S3 ou Supabase Storage | Vídeos, imagens, PDFs, certificados |
| Player | Mux / Panda Video / Cloudflare Stream + suporte a YouTube/Vimeo | Custo de banda é fator de plano no modo infoprodutor |
| Auth | JWT (access 15 min) + Refresh (7 dias) | bcrypt (12 rounds) |
| Certificados | PDFKit ou Puppeteer | Geração dinâmica |
| Webhooks | Endpoints dedicados + verificação de assinatura | Hotmart (MVP), Eduzz, Kiwify |
| IA (produção) | Claude API | Roteiros/estrutura — processo externo |
| Deploy | Vercel (front) + Railway/Render (back) | CI/CD |

### 3.4 Segurança

bcrypt (12) · HTTPS obrigatório · rate limiting em auth e webhooks · validação de entrada (zod/class-validator) · Helmet.js · CORS sem wildcard em produção · middleware de tenant · logs sem dados sensíveis · bloqueio de conta após 5 falhas por 30 min · **webhooks validados por assinatura/segredo e idempotentes**.

---

## 4. Modelo de Dados

Definição autoritativa em [`schema.prisma`](schema.prisma). Visão geral:

**Reaproveitadas da v3 (com ajustes):** `contas` (antes `empresas`, + `tipo_conta`, `dominio_proprio`), `usuarios` (role unificada), `trilhas` (+ `proprietario_tipo` + `conta_id` nullable), `modulos`, `aulas` (`tipo_video` mantido), `progresso`, `certificados`, `invite_tokens` (modo corporativo).

**Novas (modo infoprodutor / cobrança):**

| Tabela | Função |
|---|---|
| `ofertas` | Liga uma trilha ↔ produto externo (`plataforma_externa`, `codigo_produto_externo`), define `tipo_acesso` (prazo/vitalício) e `duracao_acesso_dias`. |
| `matriculas` | Acesso de um aluno a uma trilha. **É o medidor da cobrança.** `status` (ativa/inativa/expirada) + `expira_em` + `origem`. |
| `transacoes` | Log de vendas vindo dos webhooks. **Opcional** — alimenta o dashboard de vendas do infoprodutor; não é base da sua cobrança. |
| `integracoes` | Credenciais/segredo de webhook por conta e plataforma. |
| `webhook_events` | Log e **idempotência** dos eventos recebidos (hash único). |
| `assinaturas_plataforma` | Sua cobrança ao tenant: tipo (assentos/alunos_ativos), `valor_base`, `alunos_incluidos`, `valor_por_excedente`, `limite_usuarios`. |
| `faturas_plataforma` | Histórico mensal apurado (competência, ativos contados, valor total). |

**Regras gerais do banco:** UUIDs como PK · timestamps automáticos · soft delete (`deleted_at`) em conteúdo · paginação (20 padrão / 100 máx) · índices obrigatórios em `conta_id` e `(usuario_id, aula_id)` · e-mails em lowercase, únicos **por conta**.

---

## 5. Módulos e Funcionalidades

### 5.1 Autenticação
Login, logout, refresh, recuperação/redefinição de senha, aceite de convite. Senha mín. 8 com letras e números. Bloqueio após 5 falhas (30 min). Usuário `ativo=false` → 403; bloqueado → 429.

- `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout`
- `POST /auth/forgot-password` · `POST /auth/reset-password`
- `POST /auth/accept-invite` (corporativo)
- `POST /auth/signup` (infoprodutor — auto-cadastro do aluno, quando habilitado pela conta)

### 5.2 Gestão de Contas (Super Admin)
CRUD de contas (tenants) com `tipo_conta`, slug automático, subdomínio/domínio próprio, ativar/desativar (desativar bloqueia todos os usuários do tenant na hora), definição do plano de cobrança. Ao criar conta, cria o **admin do tenant** (gestor ou produtor) com convite por e-mail.

- `GET/POST /admin/contas` · `GET/PATCH /admin/contas/:id`
- `PATCH /admin/contas/:id/status` · `GET /admin/contas/:id/metricas`
- `GET/PATCH /admin/contas/:id/assinatura` (plano e parâmetros de cobrança)

### 5.3 Gestão de Usuários
- **Corporativo:** gestor cria/convida colaboradores (limitado por `limite_usuarios`), edita, desativa (dados/progresso preservados).
- **Infoprodutor:** alunos são **auto-provisionados na compra** (webhook) ou por auto-cadastro; o produtor pode criar/cortesia manual e desativar.
- Comum: `GET/PATCH /me`. Admin do tenant não pode alterar o próprio role.

- `GET/POST /painel/usuarios` · `GET/PATCH /painel/usuarios/:id` · `PATCH /painel/usuarios/:id/status`

### 5.4 Conteúdo (Trilhas → Módulos → Aulas)
Estrutura mantida da v3. **Diferença central de autoria:**
- Corporativo: conteúdo `proprietario_tipo = plataforma` (criado pelo Super Admin, visível a todas as contas corporativas).
- Infoprodutor: conteúdo `proprietario_tipo = tenant` (criado pelo **produtor**, isolado por `conta_id`).

Funcionalidades de autor (Super Admin **e** produtor, conforme propriedade): CRUD de trilhas/módulos/aulas (soft delete), reordenação, upload de vídeo (MP4 via URL pré-assinada) ou link externo (`tipo_video` = upload/youtube/vimeo), material de apoio (PDF/PPTX), legenda (SRT), publicar/despublicar.

Consumo (usuário final): listar trilhas **a que tem acesso** (corporativo: publicadas da plataforma; infoprodutor: via **matrícula ativa**), assistir com player adequado ao `tipo_video`, progresso automático a 80%, marcação manual, próxima aula, materiais/legendas.

Regras: aulas em ordem sequencial; aula bloqueada até módulo anterior ≥ 80%; progresso = aulas_concluídas / total_publicadas × 100; trilha 100% → certificado automático; soft delete obrigatório.

- Autor: `GET/POST /painel/trilhas`, `PATCH/DELETE /painel/trilhas/:id`, `.../modulos`, `.../aulas`, `POST /painel/upload/video`, `POST /painel/upload/arquivo` (Super Admin usa `/admin/...` para conteúdo de plataforma).
- Consumo: `GET /app/trilhas`, `GET /app/trilhas/:id`, `GET /app/trilhas/:id/proxima-aula`, `POST /app/progresso`, `GET /me/progresso`.

### 5.5 Matrículas e Controle de Acesso (modo infoprodutor)
A **matrícula** é o vínculo aluno↔trilha e o **medidor da cobrança**.

- `status`: `ativa` | `inativa` (desativada pelo produtor) | `expirada` (prazo vencido).
- `expira_em`: definido pela **oferta** na criação (`duracao_acesso_dias`) — ou nulo = vitalício.
- O **produtor controla o custo**: pode **inativar** antes do prazo (bloqueia acesso e sai da contagem), **prorrogar/renovar** (estende `expira_em` e reativa), **reativar**.
- Job diário marca `expira_em < hoje` como `expirada` → bloqueia acesso e sai da contagem.
- Acesso a uma trilha exige matrícula `ativa` e não vencida.

- `GET/POST /painel/matriculas` · `PATCH /painel/matriculas/:id` (inativar/prorrogar/reativar) · `GET /painel/ofertas` · `POST/PATCH /painel/ofertas`

### 5.6 Integrações e Webhooks (modo infoprodutor)
Conexão da conta com Hotmart (MVP), Eduzz e Kiwify. Cada conta cadastra credenciais/segredo (`integracoes`) e mapeia **produto externo → trilha** via `ofertas`.

Fluxo: evento recebido → valida assinatura → grava em `webhook_events` (idempotência por hash) →
- **compra aprovada** → cria/atualiza usuário aluno + cria/renova matrícula (`expira_em = hoje + duracao_acesso`) + e-mail de acesso;
- **reembolso / chargeback / cancelamento de assinatura** → **inativa** a matrícula (bloqueia acesso na hora).

- `POST /webhooks/hotmart` · `POST /webhooks/eduzz` · `POST /webhooks/kiwify` (públicos, validados, idempotentes)

### 5.7 Certificação
Reaproveitada da v3. Geração automática a 100% da trilha; PDF com nome do aluno, trilha, data, **nome e logo da conta**, código de verificação (UUID v4); página pública `/verificar/:codigo`. Gerado uma vez por `(usuario_id, trilha_id)`; PDF salvo no S3.

- `GET /me/certificados` · `GET /me/certificados/:id/download` · `GET /verificar/:codigo` (pública)

### 5.8 Dashboards
- **Corporativo:** total de colaboradores, ativos (7d), engajamento, trilhas em andamento/concluídas, ranking, inativos.
- **Infoprodutor:** alunos com matrícula ativa, novos alunos no período, taxa de conclusão por curso, matrículas a expirar, (vendas/receita se `transacoes` habilitado).

- `GET /painel/dashboard` (conteúdo varia por `tipo_conta`) · `GET /painel/dashboard/ranking` · `GET /painel/dashboard/inativos` · `GET /painel/dashboard/cursos`

---

## 6. Jornadas de Usuário

1. **Super Admin cria conta** (corporativo ou infoprodutor): define nome, `tipo_conta`, subdomínio, plano/cobrança e o admin do tenant → convite por e-mail.
2. **Gestor (corporativo) — 1º acesso:** define senha → personaliza marca → cadastra colaboradores → inicia primeira trilha do catálogo.
3. **Produtor (infoprodutor) — setup:** define senha → personaliza marca/domínio → **conecta Hotmart** (credenciais) → cria curso (trilha/módulos/aulas) → cria **oferta** mapeando o produto externo e o prazo de acesso.
4. **Aluno compra na Hotmart:** webhook de compra aprovada → Tribo Hub cria o aluno + matrícula ativa com prazo → e-mail com acesso → aluno define senha e assiste.
5. **Reembolso:** webhook → matrícula inativada → acesso bloqueado imediatamente.
6. **Colaborador (corporativo):** recebe convite → assiste → progresso automático → conclui trilha → certificado.
7. **Conclusão + certificado** (ambos os modos): trilha 100% → certificado gerado e disponível em "Meus Certificados".

---

## 7. Cobrança e Planos (sua receita)

### 7.1 Corporativo — por assentos
Planos por faixa de usuários (modelo da v3): Start (até 50), Growth (até 150), Scale (até 300), Enterprise (300+), variando catálogo, dashboard, suporte e white-label. `limite_usuarios` impede criação acima da faixa.

### 7.2 Infoprodutor — base + excedente por aluno ativo
> **Fatura = `valor_base` + `valor_por_excedente` × max(0, alunos_ativos − `alunos_incluidos`)**

- **Aluno ativo** = aluno com **matrícula `ativa` e não vencida**, contado **1 vez por conta** (dedupe entre cursos).
- O **produtor controla o custo**: define a duração da matrícula por oferta e pode inativar/prorrogar.
- Apuração no **fechamento mensal** (contagem no dia do fechamento, não pico), registrada em `faturas_plataforma`.

### 7.3 Upsells (ambos)
Trilhas personalizadas, produção sob demanda, treinamentos ao vivo, consultoria, upgrade de plano/faixa.

---

## 8. UX

Princípios da v3 mantidos: máx. 2 cliques para iniciar conteúdo · sempre indicar o próximo passo · progresso visível em todos os níveis · visual streaming (não acadêmico) · gamificação leve · "continue de onde parou" · **mobile-first** (testar iOS Safari e Android Chrome) · contraste WCAG AA.

Adicional infoprodutor: **área de membros com marca/domínio próprio** do tenant (logo, cor, domínio) — branding por host.

Telas: **/app** (home com "continue de onde parou", minhas trilhas, catálogo/meus cursos, certificados; tela de trilha; player). **/painel** (dashboard conforme modo; usuários/alunos; conteúdo; infoprodutor: integrações, ofertas, matrículas; configurações de marca). **/admin** (contas, conteúdo de plataforma, faturamento).

---

## 9. Conteúdo e Produção com IA

Hierarquia: Trilha (3–7 módulos) → Módulo (3–6 aulas) → Aula (3–8 min, estrutura fixa de 4 partes: **Problema → Explicação → Exemplo → Aplicação**).

- **Corporativo:** conteúdo produzido por nós (HeyGen para vídeo/avatar+SRT, Gamma para material, Mootion para animação, Claude/ChatGPT para roteiro). MVP de catálogo: **Trilha de Vendas (25 aulas / 5 módulos)**.
- **Infoprodutor:** traz o **próprio** conteúdo (upload de MP4 ou link externo); as ferramentas de IA são opcionais e externas.

Fluxo de produção: roteiro (IA) → curadoria humana → gravação/geração → export MP4 → upload. `tipo_video` define a renderização do player.

---

## 10. Roadmap — MVP Bimodal

> **Princípio:** primeiro vender, depois escalar. Como os dois modos sobem juntos, a base multi-tenant + `tipo_conta` é fundação comum; cada modo recebe só o essencial para fechar o primeiro cliente pagante.

### Fase 1 — MVP (base bimodal)
**P0**
- Auth (login/logout/recuperação/refresh) + multi-tenant + resolução por subdomínio
- Contas com `tipo_conta` (Super Admin) + criação do admin do tenant
- Conteúdo bimodal: catálogo de plataforma (corporativo) **e** CRUD próprio isolado (infoprodutor)
- Player (upload + YouTube/Vimeo) + progresso automático (80%) + "continue de onde parou"
- **Corporativo:** convite de colaboradores (assentos) + Trilha de Vendas (25 aulas)
- **Infoprodutor:** integração **Hotmart** (1ª plataforma) → ofertas + matrícula automática + revogação por reembolso
- Certificado PDF (ambos)
- Cobrança: assentos (corporativo) e apuração base+excedente por aluno ativo (infoprodutor)

**P1**
- Personalização de marca (logo + cor) por conta
- Dashboard básico de cada modo
- Material de apoio por aula (PDF/PPTX)
- Domínio próprio do tenant (infoprodutor)

### Fase 2 — Ajuste e validação
Dashboards completos · ranking/inativos · notificações por e-mail · legenda SRT · Eduzz e Kiwify · `transacoes`/dashboard de vendas do infoprodutor.

### Fase 3 — Expansão
Novas trilhas de catálogo (Liderança, Atendimento) · white-label avançado · relatórios CSV · painel global de faturamento · auto-cadastro/área pública de cursos do infoprodutor.

### Fase 4 — Escala
IA integrada (roteiros na plataforma) · automações de retenção · SCORM · checkout próprio opcional · webhooks de saída (CRM/Slack/Teams) · app mobile nativo.

---

## 11. Regras Gerais e Decisões Consolidadas

### 11.1 Técnicas obrigatórias
- Multi-tenant com isolamento por `conta_id` em **todas** as queries (inclui conteúdo no modo infoprodutor)
- JWT + refresh (access 15 min / refresh 7 dias)
- Soft delete em conteúdo · paginação (20/100) · timestamps automáticos · UUIDs como PK
- Validação de entrada em todos os endpoints · logs sem dados sensíveis
- `tipo_video` obrigatório em `aulas`
- **Webhooks idempotentes e validados por assinatura**
- **Matrícula é a fonte única da contagem de cobrança do infoprodutor**

### 11.2 O que NÃO construir no MVP
Checkout próprio (Fase 4 — venda fica na Hotmart/Eduzz/Kiwify) · marketplace de cursos · integrações de saída CRM/Slack/Teams (Fase 4) · app nativo (Fase 4) · gamificação complexa · relatórios Excel/CSV (Fase 3) · SCORM (Fase 4) · múltiplos idiomas.

### 11.3 Pontos de atenção
- A cobrança por aluno ativo depende da gestão correta de matrículas (criação/expiração/inativação) — o job de expiração é crítico.
- Custo de banda de vídeo cresce com a audiência do infoprodutor → considerar Panda/Cloudflare Stream e refletir no plano.

---

## 12. Glossário

| Termo | Definição |
|---|---|
| Conta (tenant) | Cliente contratante. `tipo_conta` = corporativo ou infoprodutor. Ambiente isolado. |
| Modo Corporativo | Conteúdo da plataforma, usuários por convite, cobrança por assentos. |
| Modo Infoprodutor | Conteúdo do tenant, alunos por compra, área de membros, cobrança base+excedente. |
| Trilha / Módulo / Aula | Hierarquia de conteúdo (curso → etapa → unidade de 3–8 min). |
| Oferta | Mapeamento trilha ↔ produto externo + regras de acesso (prazo/vitalício). |
| Matrícula | Acesso de um aluno a uma trilha; medidor da cobrança do infoprodutor. |
| Aluno ativo | Aluno com matrícula ativa e não vencida (dedupe por conta). |
| Webhook | Evento de compra/reembolso vindo da plataforma externa que libera/revoga acesso. |
| White-label | Personalização visual (logo, cor, domínio) por conta. |
| MRR / Churn / CAC / LTV | Métricas de negócio padrão. |
| Super Admin | Você — operação da plataforma. |
| Admin do tenant | Gestor (corporativo) ou Produtor (infoprodutor). |
| Usuário final | Colaborador (corporativo) ou Aluno (infoprodutor). |

---

## 13. Histórico de Versões

| Versão | Data | Descrição |
|---|---|---|
| 1.0–3.0 | Abr 2026 | Doctum Corporativo (corporativo single-mode). |
| **4.0** | **Jun 2026** | Reposicionamento como **Tribo Hub**: produto pessoal, bimodal (corporativo + infoprodutor). Novos: tipo de conta, propriedade/isolamento de conteúdo por tenant, autoria pelo produtor, ofertas, matrículas com ciclo de vida, integração por webhook (Hotmart/Eduzz/Kiwify) no modelo de área de membros, cobrança por base + aluno excedente ativo, resolução de tenant por host/domínio próprio, dashboards por modo. |

— FIM —
