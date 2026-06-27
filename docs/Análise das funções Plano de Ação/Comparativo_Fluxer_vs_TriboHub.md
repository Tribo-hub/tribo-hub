# Plano de Ação — Fluxer (Ladeira) × Tribo Hub

Comparativo entre o documento técnico do **Fluxer** e o que já existe na **Tribo Hub** hoje
(`PlanoAcao` / `PlanoItem` / `PlanoItemProgresso` em `schema.prisma`, `apps/api/src/planos/planos.service.ts`,
`apps/web/app/app/planos` e `apps/web/app/painel/planos`).

Legenda: ✅ temos · ⚠️ temos parcial / diferente · ❌ não temos

---

## 0. A diferença de filosofia (importante)

- **Fluxer = entrega + revisão.** O eixo é o aluno *submeter entregas* (link, arquivo, texto, confirmação),
  só conseguir "entregar o plano" com 100% das tarefas, e o mentor devolver uma **análise em vídeo**.
- **Tribo Hub = accountability integrado ao curso.** O eixo é *progredir nos itens*, com tipos que se
  conectam às aulas (`assistir` conclui sozinho ao assistir a aula; `resumo` = aula + texto), **XP/gamificação**
  ao concluir item, e o mentor acompanhando quem está em dia/atrasado.

Ou seja: temos coisas que o Fluxer **não tem** (integração com aulas, gamificação, audiência por trilha,
multi-tenant white-label) e falta o **ciclo de entrega/submissão + revisão por vídeo**, que é o coração do Fluxer.

---

## 1. Modelo de dados

### ActionPlan (Fluxer) × PlanoAcao (nosso)
| Campo Fluxer | Temos? | Observação |
|---|---|---|
| title | ✅ | `titulo` |
| subtitle (tema) | ❌ | não existe |
| cover_image (capa do card) | ❌ | plano não tem capa |
| deadline (prazo do plano) | ❌ | só temos prazo **por tarefa** (`prazoEm`), não do plano |
| released_at (liberação agendada) | ❌ | plano aparece imediatamente para a audiência |
| status (pending/submitted/reviewed) | ❌ | não há ciclo de submissão do plano |
| order (nº sequencial #1, #2…) | ❌ | planos ordenados por data de criação |
| review_video_url (análise) | ❌ | não existe |
| — trilhaId (audiência) | ✅ (extra nosso) | Fluxer não tem; mira por trilha ou conta inteira |
| — moduloId (escopo) | ✅ (extra nosso) | organização por módulo |

### Task (Fluxer) × PlanoItem (nosso)
| Campo Fluxer | Temos? | Observação |
|---|---|---|
| title | ✅ | `titulo` |
| order | ✅ | `ordem` |
| deadline (por tarefa) | ✅ | `prazoEm` |
| status (pending/completed) | ✅ | derivado de `PlanoItemProgresso.concluido` |
| description (rich text) | ❌ | **item não tem descrição** (nem rich text, links, vídeo embed) |
| delivery_type (view_only/link/text/image/file) | ⚠️ | temos `tipo` = **check / assistir / resumo** (conceito diferente) |

Mapa de tipos:
- `check` ≈ **view_only** (confirma sem anexo) ✅
- `resumo` ≈ **text** (texto livre + conclui) ✅
- `assistir` → **não existe no Fluxer**: conclui sozinho ao concluir a aula vinculada ✅ (extra nosso)
- **link** (1+ URLs) ❌ · **file/image** (upload) ❌

### TaskDelivery (Fluxer) × PlanoItemProgresso (nosso)
| Campo Fluxer | Temos? | Observação |
|---|---|---|
| text_content | ✅ | `texto` (do tipo resumo) |
| delivered_at | ✅ | `concluidoEm` |
| links[] (array de URLs) | ❌ | — |
| file_url (arquivo/imagem) | ❌ | — |
| days_before_deadline | ❌ | não calculado/guardado |

### UserPlanProgress (Fluxer)
| Campo Fluxer | Temos? | Observação |
|---|---|---|
| percentage / completed / total | ✅ | calculado em runtime (`obterPlano`, `meusPlanos`) |
| progresso isolado por usuário | ✅ | `@@unique([itemId, usuarioId])` |
| submitted_at | ❌ | sem submissão de plano |
| submission_status | ❌ | sem ciclo not_submitted/submitted/approved |

---

## 2. Funções do ALUNO

| Função Fluxer | Temos? | Observação |
|---|---|---|
| Listagem de planos em cards | ⚠️ | temos lista com título + progresso + barra; **sem capa, sem nº, sem avatar do mentor** |
| Countdown "Faltam N dias" (plano) | ❌ | só mostramos prazo/atraso **por tarefa**, não do plano |
| "Entregue com N dias de antecedência/atraso" | ❌ | não há entrega de plano |
| Badge "Concluído" + "Assistir análise →" | ❌ | sem análise em vídeo |
| Página de detalhe `/plano/:id` (hero, breadcrumb, badge de nível) | ❌ | tudo fica **inline** numa lista única em `/app/planos` |
| Painel lateral "Entregáveis" + contador global | ⚠️ | temos contador X/Y e % por plano, mas não o layout de painel |
| Alternância Lista / Grid | ❌ | só lista |
| Modal de detalhe da tarefa (rich text, copiar, prazo) | ❌ | itens são inline; **sem descrição rica por tarefa** |
| Modal de submissão por tipo | ⚠️ | `check` = checkbox direto; `resumo` = textarea inline; **sem link/arquivo**, sem modal |
| Botão "Entregar plano" (gate 100%) | ❌ | não existe submissão de plano |
| Seção metadados (Prazo / Timeline) | ❌ | — |
| Carrossel de planos "Você está aqui" | ❌ | — |
| Item tipo "assistir" (conclui ao ver a aula) | ✅ (extra nosso) | integra com o progresso da aula |
| XP por concluir item | ✅ (extra nosso) | gamificação |

---

## 3. Funções do ADMIN / MENTOR

| Função Fluxer | Temos? | Observação |
|---|---|---|
| Criar plano (título) | ✅ | |
| Subtítulo / capa / order | ❌ | não temos esses campos |
| Data de liberação (released_at) | ❌ | sem agendamento |
| Prazo do plano (deadline) | ❌ | só por tarefa |
| Atribuir plano a aluno(s) específico(s) | ⚠️ | miramos por **trilha** (matriculados) ou **conta inteira**, não seleção individual |
| Criar tarefa (título, ordem, prazo) | ✅ | |
| Descrição rich text da tarefa | ❌ | item só tem título |
| Definir delivery_type | ⚠️ | check/assistir/resumo (não link/arquivo) |
| Reordenar tarefas (drag & drop) | ❌ | `ordem` automática, sem reordenar na UI |
| Monitorar progresso dos alunos | ✅ | tabela de acompanhamento: progresso, atrasados, em dia/atrasado |
| Ver detalhe por aluno (cumpriu/falta + resumo) | ✅ (forte) | modal por aluno com itens, datas e texto do resumo |
| Ver entregas (links/arquivos) | ⚠️ | vemos o texto do `resumo`; **sem link/arquivo** porque os tipos não existem |
| Gravar/subir análise em vídeo (review_video_url) | ❌ | não existe |

---

## 4. Regras de negócio críticas (do Fluxer)

| Regra Fluxer | Temos? | Observação |
|---|---|---|
| 1. Gate de entrega do plano (100% → habilita) | ❌ | não há entrega de plano |
| 2. Múltiplos links por tarefa | ❌ | — |
| 3. Prazo duplo (tarefa + plano) | ⚠️ | só prazo de tarefa |
| 4. Countdown dinâmico | ⚠️ | "atrasado" sim; "faltam N dias" / pós-entrega não |
| 5. Análise condicional (vídeo só após entregar) | ❌ | — |
| 6. Progresso isolado por usuário | ✅ | |
| 7. view_only = entrega válida | ✅ | nosso `check` |
| 8. Checkbox sempre abre modal de submissão | ❌ | marcamos direto (sem modal) |

---

## 5. O que só NÓS temos (vantagens da Tribo Hub)
- **Integração com as aulas**: tipo `assistir` conclui automaticamente ao concluir a aula; `resumo` = aula + texto.
- **Gamificação**: XP ao concluir item de plano.
- **Audiência por trilha + escopo por módulo** (o Fluxer atribui aluno a aluno).
- **Multi-tenant white-label** + flag por conta (`planosAtivos`) para ligar/desligar o recurso.
- **Acompanhamento do mentor** já maduro (em dia/atrasado, detalhe por aluno com datas e resumo).

---

## 6. Lacunas para chegar à paridade com o Fluxer (se for o objetivo)

Em ordem de impacto:

1. **Ciclo de entrega do plano** (o coração do Fluxer): `status` do plano (pending/submitted/reviewed),
   `submitted_at`, gate de 100%, botão "Entregar plano". → mexe em schema + service + UI.
2. **Análise pós-entrega por vídeo** (`review_video_url`) com desbloqueio condicional para o aluno.
3. **Tipos de entrega `link` e `arquivo/imagem`** + `TaskDelivery` guardando `links[]`/`file_url`
   (hoje só guardamos texto do resumo). Requer upload (Supabase Storage já existe no projeto).
4. **Descrição rich text por tarefa** (instruções, links, vídeo embed) + modal de detalhe da tarefa.
5. **Prazo do plano + data de liberação agendada** (`deadline`, `released_at`) e **countdown** "faltam N dias".
6. **Capa, subtítulo e nº de ordem** do plano (cards estilo Fluxer) + página de detalhe dedicada `/app/planos/:id`.
7. **Reordenar tarefas (drag & drop)** no painel do mentor.
8. (Opcional) **Atribuição por aluno específico**, além da audiência por trilha.

> Observação de escopo: itens 1–3 transformam o nosso "checklist com accountability" no modelo
> "entrega + revisão" do Fluxer. 4–8 são incrementos de UX/parametrização.

---

*Gerado em 26/06/2026 a partir de `DocumentoTecnico_PlanoDeAcao_Fluxer.txt` e do código atual da Tribo Hub.*
