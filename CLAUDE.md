# CLAUDE.md — sh-sante-ha-zepp (Home Assistant para Zepp OS)

Leia também `HANDOFF.md` (estado atual) e `README.md`.

## Regras gerais
- Responder ao usuário em **português (PT-BR)**.
- **Nunca** commitar/pushar em `main`: sempre branch `feat/...` + PR; a pipeline (`verify`, `precompile (API 1.0/3.6/4.0)`) precisa passar.
- Toda feature pedida vale para **todos os builds**: modern **e** `legacy/`. Se não der para portar, dizer explicitamente.
- Não mostrar segredos (token do HA) inteiros em nenhuma tela: use `maskSecret`/`maskToken` (só últimos 4).

## Estrutura
| Caminho | Papel |
|---|---|
| `page/**` | Telas do relógio (modern, `@zos/*`, API 3.x/4.0) |
| `app-side/**` | Side service no celular (fala com o HA, repassa ao relógio) |
| `app-service/**` | Serviços em background no relógio |
| `setting/index.js`, `setting/logic.js` | Página de configurações no app Zepp do celular (modern); lógica pura em `logic.js` (testável) |
| `utils/direct-http.js` | Requisição direta relógio→HA via Wi-Fi (fallback: celular) |
| `shared/` | Protocolo e validação comuns |
| `legacy/` | App completo e independente para **API 1.0** (`configVersion v2`, hmUI/hmApp globais). Copiado inteiro no build 1.0 |
| `build.config.js` | Perfis por API (`1.0` legacy, `3.6`, `4.0` modern); flags de feature |
| `scripts/build.js` | Gera `app.json` (não versionado) a partir de `app.template.json` e roda `zeus build` por perfil; saída em `dist/` |
| `test/` | `node --test`; helpers em `test/helpers/watch.js` (importa cada módulo uma vez e re-registra) |

## Comandos
```bash
npm test                         # testes + cobertura
npm run check                    # tsc via JSDoc (anote @param em funções novas)
node scripts/build.js --api 3.6  # um perfil
node scripts/build.js --api all  # todos (legacy + modern)
```

## Convenções de implementação
- **Configurações (Zepp settings API)**: `AppSettingsPage({ build(props) })`, componentes `View/Section/Text/TextInput/Toggle/Button/Select`. A página reconstrói a cada `settingsStorage.setItem`; use isso para abas/filtros/paginação (guardar estado em chaves como `settingsActiveTab`, `filter`, `entityTypeFilter`, `filterFav`, `entityPage`). **Nunca** coloque `cond && X` em arrays de filhos — use `...(cond ? [X] : [])`.
- `TextInput` de segredo: `value` mascarado; no `onChange` ignore valor vazio ou igual à máscara.
- **Luzes**: modos derivados de `supported_color_modes` (`onoff`/`brightness`/`color_temp`/`hs|rgb|xy`); navegação por deslize lateral, toque fora dos controles e coroa.
- **Coroa**: modern `onDigitalCrown/offDigitalCrown` (`@zos/interaction`); legacy `hmApp.registerSpinEvent`. Trave eventos em rajada (uma ação por giro) e libere em `onDestroy`.
- **Gestos**: não intercepte o deslize para a direita quando não há para onde voltar internamente — deixe o sistema fazer "voltar".
- **Wi-Fi direto**: tente `utils/direct-http.js` primeiro quando houver URL+token e rede; em erro, caia para o side service (BLE).
- Testes: toda função nova com teste; manter cobertura de linhas/funções ~100%.

## Emulador
O emulador estendido (`/home/mzramna/Documentos/zeppos-mcp-emulator`, repo `mzramna/ZeppPlayer`) roda as suítes E2E deste app (`npm test` lá) e expõe ferramentas MCP (`emulator_load_app`, `emulator_get_screen`, `emulator_click`, ...).
