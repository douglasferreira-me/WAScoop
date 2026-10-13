# Desenvolvimento e forks

Este guia complementa as [instruções de uso](../README.md). O usuário instala o pacote pronto; os requisitos abaixo são somente para quem vai modificar ou reconstruir o projeto.

## Preparar sua cópia

Você precisa de Git, Node.js 22 ou posterior (com npm), Python 3 e Firefox desktop 140 ou posterior.

1. No GitHub, clique em **Fork** no [repositório original](https://github.com/douglasferreira-me/WAScoop) e crie uma cópia na sua conta.
2. No terminal, execute os comandos abaixo, substituindo `SEU-USUARIO` pelo seu nome no GitHub.

```sh
git clone https://github.com/SEU-USUARIO/WAScoop.git
cd WAScoop
npm ci
npm test
npm run build
npm run lint
npm start
```

`npm ci` instala as versões exatas do `package-lock.json`. `npm test` verifica o comportamento com dados sintéticos. `npm run build` empacota as dependências locais e gera a distribuição; `npm run lint` verifica as regras da extensão. `npm start` abre a extensão em um perfil de desenvolvimento do Firefox. Para usar seu navegador habitual, carregue `dist/whatsapp-scoop-temporario/manifest.json` conforme o README.

## Entender o fluxo e localizar mudanças

A página fornece mensagens conforme a conversa é rolada. O coletor registra os dados antes que desapareçam da interface, elimina duplicações e envia lotes ao background. Este persiste mensagens e mídias em IndexedDB e coordena a exportação ou o envio ao Drive.

| Arquivo ou pasta | Responsabilidade |
| --- | --- |
| `extension/content/adapters.js` | Reconhecer grupos/canais, mensagens, links, reações, área de rolagem e controles de mídia. |
| `extension/content/collector.js` | Coletar, controlar o período, pausar e conferir a conversa ativa. |
| `extension/lib/api-media.js` | Recuperar mídias pela WA-JS na sessão conectada. |
| `extension/lib/core.js` | Datas, deduplicação, pseudônimos e formato do CSV. |
| `extension/lib/store.js` | Persistência e leitura paginada no IndexedDB. |
| `extension/lib/export.js` | CSV, ZIP, índice de mídias e relatório. |
| `extension/lib/drive.js` | Autorização Google e uploads retomáveis. |
| `extension/lib/diagnostics.js` | Registro local de diagnóstico com campos permitidos e remoção de informações sensíveis. |
| `extension/background.js` | Coordenação dos módulos, comandos e estado da coleta. |
| `extension/panel.html`, `.css`, `.js` | Interface em português. |
| `scripts/build.py`, `scripts/brand.cjs` | Pacotes reproduzíveis e ícones derivados do SVG. |
| `tests/` | Testes e exemplos sintéticos. |

Para alterações na interface do WhatsApp, comece pelos adaptadores e adicione um exemplo sintético que reproduza o problema. Para alterar colunas, ajuste o núcleo, a exportação, os testes e a documentação juntos. Não coloque conversas reais, mídias pessoais ou credenciais no Git.

### Mídias e integração com a sessão

A extensão tenta a API WA-JS primeiro; se falhar, tenta controles de mídia reconhecidos na página. O índice registra `origem_captura`. Nunca trate uma miniatura como arquivo original nem clique em links externos para recuperar mídias.

A WA-JS é empacotada localmente. Funções fixas executam no contexto `MAIN` via `browser.scripting.executeScript`, conferindo a conversa ativa e um identificador único. A transferência usa blocos de 256 KiB; os arquivos ficam como Blobs no IndexedDB. Preserve as verificações de conversa, cancelamento e limites ao modificar esse fluxo.

O build substitui um caminho Node baseado em `eval(require)` do bundle upstream, desnecessário no Firefox, por um erro explícito. Ao atualizar a WA-JS, revise esse patch e teste a integração; não habilite `unsafe-eval` nem carregue código remoto para contorná-lo.

### Contrato dos dados

- Identificadores nativos são preferidos; sem eles, a deduplicação considera conteúdo, contexto e posição. Repetições indistinguíveis podem continuar ambíguas.
- O CSV usa UTF-8 com BOM, vírgulas, campos entre aspas e linhas CRLF. Datas reconhecidas são ISO/UTC; datas desconhecidas ficam vazias e são ordenadas ao final.
- Para evitar fórmulas em planilhas, campos que começam com sinais de fórmula recebem um apóstrofo. Para reconstrução textual, remova um apóstrofo somente diante de `=`, `+`, `-`, `@`, tabulação ou retorno de carro; a regra consta no relatório.
- `MID-000001` identifica uma mídia dentro da coleta, na ordem de recuperação. `midias_ids` e `midias` mantêm associações na mesma ordem, também registradas no índice com mensagem, caminho e SHA-256.
- Reações são uma observação temporal. Preserve a distinção entre total exato, aproximado e indisponível; ausência não equivale a zero.

## Validar antes de distribuir

Execute os testes, build e lint após mudanças. Para testar a extensão no navegador com fixtures locais e perfil isolado:

```sh
FIREFOX_BIN=/caminho/para/firefox GECKODRIVER_BIN=/caminho/para/geckodriver npm run test:firefox
```

Instale previamente o geckodriver e substitua os caminhos pelos executáveis locais. Esse teste usa uma API simulada: não comprova compatibilidade com uma sessão WhatsApp real. Siga o [roteiro de testes manuais](TESTES.md) em grupo e canal sob seu controle, comparando CSV, mídias, referências, pausas e exportações parciais. Registre limites em [VALIDACAO.md](VALIDACAO.md).

O Drive exige cliente Google e redirecionamento reais. Siga [GOOGLE_DRIVE.md](GOOGLE_DRIVE.md); não o anuncie como operacional sem validar login e upload. O fluxo OAuth atual é legado e desaconselhado pelo Google para novas aplicações. Tokens ficam somente na sessão; uploads usam blocos de 1 MiB e até quatro tentativas por requisição.

## Empacotar e publicar seu fork

`npm run build` gera em `dist/`:

- `whatsapp-scoop-temporario/` e ZIP temporário: instalação de teste;
- XPI não assinado: pacote para solicitar assinatura à Mozilla;
- ZIP do código-fonte: revisão e reprodução;
- `SHA256SUMS.txt`: hashes dos pacotes.

Os nomes incluem a versão. O build fixa a ordem, as datas e as permissões dos arquivos para permitir reprodução. As bibliotecas e suas licenças seguem dentro do pacote; o pesquisador não precisa instalar dependências.

Antes de distribuir um fork, ajuste nome, autor, site e ID em `extension/manifest.json` e sincronize a versão com `package.json` e o lockfile. Um ID próprio permite instalar o fork sem substituir a extensão original. Se usar Drive, configure um cliente próprio: mudar o ID também muda o redirecionamento OAuth.

A instalação permanente no Firefox comum depende de assinatura. Envie o pacote pelo [portal de extensões Mozilla](https://addons.mozilla.org/developers/), com os fontes e instruções de build quando solicitados. Revise [permissões e privacidade](PRIVACIDADE.md) e teste o pacote assinado antes de disponibilizá-lo.

Preserve a licença **GPL-3.0** e a atribuição original a [douglasferreira](https://douglasferreira.me). zip.js usa BSD-3-Clause e WA-JS usa Apache-2.0; mantenha os arquivos de licença incluídos. A [logo](branding/README.md) e seus ícones ficam no repositório.
