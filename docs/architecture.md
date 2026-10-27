# Arquitetura e Funcionamento — Home Assistant para Zepp OS (`sh-sante-ha-zepp`)

Este documento descreve detalhadamente o funcionamento técnico, o ciclo de vida e a arquitetura do aplicativo Home Assistant para relógios Zepp OS (Amazfit).

---

## 1. Visão Geral da Arquitetura

O ecossistema do aplicativo é dividido em três camadas interconectadas:

1. **Watch App (`page/**` e `legacy/page/**`)**:
   - Interface visual renderizada diretamente no display do smartwatch.
   - Comunica-se com o Home Assistant de forma híbrida: **Wi-Fi direto** (quando o relógio tem conectividade local e URL/Token configurados) ou via **BLE para o App-Side** do smartphone (fallback transparente).

2. **App-Side (`app-side/**` e `legacy/app-side/**`)**:
   - Serviço em JavaScript executado no smartphone (dentro do aplicativo Zepp / Zepp Life).
   - Gerencia autenticação com Home Assistant via REST API e WebSocket, encaminhamento de requisições de controle e sincronização de dados de saúde.

3. **Settings Page (`setting/**` e `legacy/setting/**`)**:
   - Painel de configuração no smartphone para definir URLs (Local/Externa), tokens de acesso de longa duração, favoritos e visibilidade de entidades por abas e categorias.

---

## 2. Árvores de Compilação Multi-API

O projeto é mantido sob uma estratégia multi-versão orquestrada por `build.config.js` e `scripts/build.js`:

* **Modern Tree (`API 3.6+` e `API 4.0`)**:
  - Código na raiz (`page/`, `app-side/`, `setting/`, `utils/`).
  - Baseado no framework `@zeppos/zml` e módulos nativos `@zos/*` (`@zos/ui`, `@zos/interaction`, `@zos/router`, etc.).
  - Gera os binários `dist/ha-zepp-api3.6.zab` e `dist/ha-zepp-api4.0.zab`.
  - Suporta coroa digital (`onDigitalCrown`), gestos avançados de toque e deslize (`onGesture`), dashboard de energia e Wi-Fi direto nativo via `fetch`.

* **Legacy Tree (`API 1.0` / Zepp OS 1.x)**:
  - Código isolado na pasta `legacy/` (`configVersion: "v2"`).
  - Utiliza globais de baixo nível (`hmUI`, `hmApp`, `hmBle`, `messageBuilder`).
  - Gera `dist/ha-zepp-api1.0.zab` cobrindo dispositivos clássicos (Band 7, GTR 3, T-Rex 2).

---

## 3. Fluxo de Controle de Iluminação (Luzes)

A tela de detalhes da luz (`page/light/index.js`) implementa um carrossel dinâmico por deslize lateral e toque externo baseado nas capacidades da entidade reportadas pelo Home Assistant (`supported_color_modes`):

- **Modo Potência/Brilho (`brightness`)**: Anel deslizante de 0% a 100%.
- **Modo Tonalidade (`color_temp`)**: Ajuste de temperatura de cor (Kelvin) com conversão automática de mireds.
- **Modo Coloração (`color`)**: Ajuste contínuo de matiz HSV de 0° a 360° com atualização visual dinâmica da cor no anel.
- **Navegação Inteligente**:
  - Deslize lateral (`GESTURE_LEFT` / `GESTURE_RIGHT`) alterna entre os modos disponíveis.
  - Toque fora do botão liga/desliga ou dos controles do anel avança ciclicamente para a próxima tela de modo.
  - O toque central ou no botão liga/desliga alterna o estado (toggle).

---

## 4. Diretiva de Conectividade Híbrida (Wi-Fi Direto com Fallback BLE)

Localizado em `utils/direct-http.js`:
- Ao despachar um comando ou sincronização, o relógio verifica se possui credenciais válidas e conectividade HTTP direta com a URL configurada do Home Assistant.
- Se disponível, executa a requisição `fetch` diretamente pelo relógio, reduzindo drasticamente a latência e contornando engasgos de processamento ou Bluetooth no celular.
- Caso ocorra falha de rede ou timeout, o sistema imediatamente repassa a requisição via BLE para o `app-side` do smartphone realizar a chamada e devolver o resultado.
