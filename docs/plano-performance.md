# Plano de Performance — TriboHub ("tão rápido quanto Netflix")

Objetivo: eliminar o flash da marca e deixar a navegação do aluno (curso/aula) instantânea,
sem quebrar nada do que já está no ar. Execução em **5 fases**, na ordem abaixo. Cada item
tem: **o quê**, **arquivos**, **risco**, **como validar**. Marque `[x]` ao concluir.

Princípio Netflix atacado: (1) cache-first, (2) prefetch, (3) CDN de mídia, (4) menos idas ao servidor.

---

## 🔒 Regras de ouro (ler antes de cada fase)

1. **Uma fase por vez.** Commit por item/fase, deploy, rodar o smoke test, só então avançar.
2. **NÃO mexer no que está pronto e funcionando** (ver lista abaixo). Otimização é aditiva:
   preferir NOVA camada (helper de cache, wrapper) a reescrever endpoint que já funciona.
3. **Mesma resposta, mais rápido.** Ao otimizar um endpoint, o *shape* do JSON de resposta
   deve ficar IDÊNTICO — só muda como é computado. Se o shape mudar, o front quebra.
4. **Validar após cada deploy** com o smoke test (fim do doc). Qualquer regressão → reverter
   só aquele commit (`git revert <hash>`), não o histórico todo.
5. **Typecheck + build** verdes antes de todo deploy (`tsc --noEmit` API e web; `next build`).

### ⛔ NÃO TOCAR (sistemas prontos — só ler, nunca alterar a lógica)
- **Auth/login**: `auth.service.ts`, `auth.controller.ts`, JWT, refresh, `lib/api.ts` (o fluxo
  de token/refresh; só ADICIONAR camada de cache sem mexer no Authorization/refresh).
- **Cobrança/trial**: `subscription-status.guard.ts`, `usuarios.service.ts` (lógica de
  `bloqueado`/`trialAte`), billing. (Podemos cachear `/me`, mas sem mudar a regra de bloqueio.)
- **Tenant/domínio**: `tenant.middleware.ts`, header `X-Tenant-Slug`, CORS em `main.ts`,
  `publico.controller.ts`, `cloudflare.service.ts`, `dominio/*`, `infra/saas-proxy`.
- **Regra de acesso do aluno**: filtro de matrícula ativa em `aluno.service.ts` (`filtroAcesso`)
  — otimizar as QUERIES é ok; mudar QUEM vê o quê, não.

---

## FASE 0 — Preparação (sem código)

- [ ] **0.1 Baseline.** Medir hoje, no navegador (F12 → Network), e anotar: tempo de abrir a
  home do aluno, abrir um curso, abrir uma aula. Serve para provar a melhora depois.
- [ ] **0.2 Git limpo.** Confirmar tudo commitado e pushado (`git status` limpo, `main` = origin).
- [ ] **0.3 Definir contas de teste** para o smoke test: 1 super admin, 1 produtor, 1 aluno com
  curso matriculado.

---

## FASE 1 — Backend: assinaturas em lote + cache (MAIOR ganho, baixo risco)

Gargalo nº1: abrir uma trilha assina 1 URL por vídeo/material/anexo de CADA aula (150-200
round-trips ao Supabase por request), e refaz isso a cada "marcar concluída".

- [ ] **1.1 Helper de assinatura em lote + cache.** Em `apps/api/src/storage/storage.service.ts`:
  - Adicionar `urlsDeDownload(paths: string[])` usando o `createSignedUrls` (plural) do Supabase.
  - Cache em memória `path -> {url, exp}` com TTL ~50 min (URLs valem 60 min). Reusa entre requests.
  - **Risco:** baixo (métodos NOVOS, não altera `urlDeDownload` existente).
  - **Validar:** unit/manual — assinar 3 paths retorna 3 URLs válidas; 2ª chamada usa cache.
- [ ] **1.2 `obterTrilha` assina em 1 lote.** `apps/api/src/aluno/aluno.service.ts` (~167-221):
  coletar TODOS os paths (vídeo/material/legenda/anexos de todas as aulas) → 1 chamada
  `urlsDeDownload` → distribuir. **Shape da resposta idêntico.**
  - **Risco:** médio (endpoint quente). Mitigação: comparar JSON antes/depois com a mesma trilha.
  - **Validar:** abrir a mesma trilha; conferir que vídeo, material, legenda e anexos abrem; tempo cai muito.
- [ ] **1.3 `listarTrilhas` sem N+1.** `aluno.service.ts` (~50-71): assinar capas em lote e
  agregar progresso (evitar 1 query de progresso por trilha). Shape idêntico.
  - **Validar:** "Minhas trilhas" lista igual, com progresso correto, mais rápido.
- [ ] **1.4 Não refazer a trilha ao marcar concluída.** `apps/web/app/app/player/page.tsx`
  (`alternarConclusao`/`avaliar`): atualizar o estado local em vez de `carregar()` a trilha inteira
  (ou o backend retornar só o item alterado). Evita re-assinar tudo a cada clique.
  - **Validar:** marcar/desmarcar aula reflete na hora, sem recarregar o player todo.
- [ ] **1.5 Deploy + smoke test.** Commit `perf(aluno): assinaturas em lote + cache`.

---

## FASE 2 — Backend: home, /me e transporte

- [ ] **2.1 Paralelizar a home.** `apps/api/src/jornada/jornada.service.ts`: `Promise.all` nos
  trechos independentes (conta, matrículas, gamificação, próxima live, planos). Remover o refetch
  redundante de `/app/planos/{id}` no cliente (`apps/web/app/app/page.tsx` ~96) — o dado já vem em `/app/jornada`.
  - **Validar:** home carrega igual, menos chamadas na aba Network.
- [ ] **2.2 `meusPlanos` sem N+1.** `apps/api/src/planos/planos.service.ts` (~332-345):
  resolver âncoras numa query única para todos os planos; assinar capas em lote (helper 1.1).
- [ ] **2.3 `/me` uma vez + cache.** Assinar logo/avatar via cache do helper; cache curto (~30-60s)
  do `/me` no servidor por usuário. **Sem mudar a regra de `bloqueado`/`trialAte`.**
  - **Validar:** login, marca e bloqueio de inadimplência continuam corretos (smoke test billing).
- [ ] **2.4 Compressão + Cache-Control.** `apps/api/src/main.ts`: adicionar `compression()` (gzip/br).
  `Cache-Control` curto em GETs públicos/estáveis (`/publico/marca`, catálogo). **Não** cachear
  rotas autenticadas sensíveis.
  - **Validar:** respostas vêm `content-encoding: gzip`; nada autenticado é cacheado indevidamente.
- [ ] **2.5 Deploy + smoke test.** Commit `perf(api): home paralela, /me cache, compressão`.

---

## FASE 3 — Cliente: cache-first + prefetch (o "feeling Netflix")

Mais sensível (mexe em `lib/api.ts`, usado em todo lugar) — additivo e opt-in.

- [ ] **3.1 `/me` compartilhado.** Um provider/contexto (ou cache em memória) que busca `/me`
  UMA vez e todas as telas consomem — em vez de cada página buscar de novo.
  - **Validar:** sidebar, header e páginas mostram os mesmos dados; 1 `/me` por sessão de navegação.
- [ ] **3.2 Cache stale-while-revalidate.** Camada leve (SWR ou wrapper próprio em `lib/api.ts`)
  que guarda a última resposta por chave e mostra na hora + revalida em background. **Opt-in por
  chamada** (não alterar o comportamento das chamadas existentes por padrão).
  - **Risco:** médio — não mudar o fluxo de token/refresh; cache só de GET.
  - **Validar:** voltar para uma tela já visitada aparece instantâneo; dado atualiza sozinho.
- [ ] **3.3 Prefetch.** Ao passar o mouse/ocioso, adiantar dados prováveis (curso ao ver a lista,
  próxima aula). `router.prefetch` + prefetch de dados.
  - **Validar:** abrir curso/aula já visto parece instantâneo.
- [ ] **3.4 Deploy + smoke test.** Commit `perf(web): cache-first + prefetch`.

---

## FASE 4 — Marca sem flash (branding)

Feito por último entre as mudanças de código porque a migração de cor mexe no visual de vários
componentes. Também corrige o bug do cache de marca não ser por domínio.

- [ ] **4.1 Cache de marca por hostname.** `apps/web/lib/marca.ts`: chavear `tribo_marca` por
  `window.location.hostname` (hoje é global → mostra marca do cliente ERRADO ao trocar de domínio).
  Não apagar a marca no logout (`lib/api.ts` `clearToken` — manter a marca do host).
  - **Validar:** alternar entre dois tenants não mostra a marca do outro; relogar não dá flash.
- [ ] **4.2 Variável CSS de cor.** `apps/web/app/globals.css` + `tailwind.config.ts`: criar
  `--cor-primaria` (default = roxo atual `#7c3aed`) e uma cor Tailwind que lê a variável.
  - **Risco:** baixo se o default = roxo atual (nada muda até aplicar por tenant).
- [ ] **4.3 Script pre-paint.** `apps/web/app/layout.tsx`: no `<head>`, script síncrono que lê a
  marca cacheada (por host, item 4.1) e seta `--cor-primaria` ANTES do primeiro paint (igual ao
  script de dark mode). Warm cache = zero flash de cor.
- [ ] **4.4 Cold start neutro.** Quando não há cache (1º acesso), não mostrar "Tribo Hub":
  skeleton/neutro até resolver a marca. `AlunoHeader.tsx` passa a semear do cache como os outros.
  - **Validar:** 1º acesso não pisca "Tribo Hub"; acessos seguintes já abrem com a marca do cliente.
- [ ] **4.5 Migrar cor primária para a variável.** Trocar `tribo-*` (primária) por `--cor-primaria`
  nos componentes-chave (botões `ui/Button`, header, sidebar, badges). Incremental, conferindo o
  visual. O TriboHub próprio segue roxo (default da variável).
  - **Validar (visual):** abrir dois tenants com cores diferentes — o app inteiro assume a cor de cada um.
- [ ] **4.6 Deploy + smoke test (visual, 2 tenants).** Commit `perf(marca): sem flash + cor global`.

---

## FASE 5 — Infra / mídia (depende de decisão sua; pode ter custo)

- [ ] **5.1 Vídeo via CDN.** Opções: (a) Cloudflare na frente do Storage (cache + range), (b)
  migrar upload de vídeo para **Cloudflare Stream** (streaming adaptativo, verdadeiro "Netflix").
  Decisão + custo antes de implementar.
- [ ] **5.2 Cache de borda** (Cloudflare) para GETs públicos/estáveis (marca pública, catálogo).
- [ ] **5.3 (Avaliar) Latência geográfica.** API mais perto do Brasil ou endpoints de leitura no
  edge. Maior esforço — só se ainda fizer diferença após as fases 1-3.

---

## ✅ Smoke test (rodar após CADA deploy)

1. **Login** funciona: super admin, produtor e aluno entram (nenhum cai pro login).
2. **Cobrança:** conta em trial/ativa entra normal; (se houver) inadimplente vê a tela de Pix, não desloga.
3. **Aluno:** home carrega; abrir curso; abrir aula (vídeo + material + anexos); marcar aula concluída.
4. **Marca:** logo/cor/nome do tenant aparecem corretos (e o do tenant certo).
5. **Domínio próprio / subdomínio:** `mentoria.tribohub.com.br` e `app.tribodevendas.com.br` abrem.
6. **Regressão de rede:** conferir na aba Network que o nº de chamadas caiu e os tempos melhoraram
   vs. o baseline (0.1).

Qualquer item falhar → `git revert` do commit da vez e diagnosticar antes de seguir.
