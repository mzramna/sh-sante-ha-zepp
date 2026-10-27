# Diretivas de Planejamento e Handoff para Agentes — Home Assistant Zepp

Este documento contém as diretivas de continuidade, planejamento arquitetural e regras obrigatórias para agentes de IA que assumirem o desenvolvimento deste repositório.

---

## 1. Regras Fundamentais e Restrições de Branches

1. **PROIBIDO COMMITAR DIRETAMENTE NA `main` OU `master`**:
   - Todo trabalho deve ser realizado em branches de funcionalidade (e.g. `feat/...`) e submetido via Pull Request.
   - A branch ativa para esta demanda é `feat/zepp-crown-light-modes-tabs-energy-wifi` ([PR #3](https://github.com/mzramna/sh-sante-ha-zepp/pull/3)).
   - Antes de qualquer merge, as pipelines do GitHub Actions (`verify`, `precompile (API 1.0)`, `precompile (API 3.6)`, `precompile (API 4.0)`) devem estar 100% verdes.

2. **Idioma e Resposta ao Usuário**:
   - Sempre responda ao usuário em **Português (PT-BR)**.
   - Forneça links clicáveis no formato `[arquivo](file:///caminho/do/arquivo)`.

---

## 2. Diretiva de Paridade Modern vs Legacy

Qualquer recurso de interface ou regra de negócio introduzida no app deve considerar as duas árvores:
- **Modern (`page/**`)**: Usa `@zos/ui`, `@zos/interaction`, `@zeppos/zml`.
- **Legacy (`legacy/page/**`)**: Usa `hmUI`, `hmApp`, `messageBuilder`.
- Se uma nova funcionalidade for adicionada ao `page/light/`, certifique-se de manter paridade funcional equivalente na versão legada (`legacy/page/light/`).

---

## 3. Diretiva da Interface de Configurações (Zepp Phone Settings)

O runtime `AppSettingsPage` é extremamente sensível a nós inválidos:
- **NUNCA** use avaliações curtas booleanas em arrays de componentes filhos:
  ```javascript
  // ERRADO (provoca quebra no runtime mobile da Zepp):
  View({ style }, [ cond && Component() ])

  // CORRETO:
  View({ style }, [ ...(cond ? [Component()] : []) ])
  ```
- **Segurança e Privacidade de Tokens**:
  - Tokens de autenticação de longa duração (`HAToken` / `token`) nunca devem ser expostos integralmente na tela.
  - Utilize sempre máscaras que exibam somente os últimos 4 caracteres (e.g. `••••••••${token.slice(-4)}`) e trate o `onChange` para ignorar valores idênticos à máscara ou vazios.

---

## 4. Roteiro e Backlog de Próximos Passos

1. **Paridade Completa de Telas de Luz no Legacy**:
   - Levar o controle por modos (`brightness`, `color_temp`, `color`) para o `legacy/page/light/index.page.js` usando os controles gráficos legados (`createProgressBar`, `nativeSlider`, troca de modo por gestos).
2. **Dashboard de Energia no Legacy**:
   - Criar página correspondente a `page/energy/index.js` em `legacy/page/energy/index.page.js`.
3. **Validação E2E com o Emulador**:
   - Executar os testes automatizados com o emulador ZeppPlayer (`/home/mzramna/Documentos/zeppos-mcp-emulator`).
