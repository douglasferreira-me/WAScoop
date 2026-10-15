# Desenvolvimento e forks

Este guia complementa as [instruções de uso](../README.md). O usuário instala o pacote pronto; os requisitos abaixo são somente para quem vai modificar ou reconstruir o projeto.

## Preparar sua cópia

Você precisa de Git, Node.js 22 ou posterior (com npm), Python 3 e Firefox desktop 140 ou posterior.

Na raiz do seu checkout, execute:

```sh
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
| `extension/lib/export.js` | CSV, XLSX, ZIP, índice de mídias e relatório. |
| `extension/lib/workbook.js` | XLSX em SpreadsheetML, com estilos, filtros, datas e contagens tipadas; usa a biblioteca ZIP já incluída. |
| `extension/lib/drive-sync.js` | Fila persistida, confirmação de mídia e atualização do mesmo CSV no monitoramento. |
| `extension/lib/hash.js` | SHA-256 incremental em blocos de 1 MiB com @noble/hashes. |
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
- `options.workbook` controla a geração opcional de XLSX; o padrão é desmarcado. Não gere o workbook quando essa opção estiver ausente ou falsa. A interface avisa sobre o tempo adicional.
- O XLSX usa a mesma transformação e os mesmos pseudônimos do CSV. Textos são células `inlineStr`, nunca fórmulas. Datas são valores numéricos em UTC; contagens desconhecidas continuam vazias. A geração percorre o IndexedDB sem montar uma matriz do corpus inteiro. Campos acima de 32.767 caracteres ficam completos em partes na aba Textos longos; tabelas acima de 1.048.575 registros são divididas em abas.
- CSV e, quando solicitado, XLSX ficam na raiz, mídias em `midias/` e JSONs em `.system/`, inclusive no fluxo experimental do Drive. Os links da aba Mídias são relativos: exigem o ZIP extraído e a pasta preservada.
- `ScrollTracker` distingue ausência de novos IDs de ausência de movimento. Reconsulte o contêiner após mudanças no DOM; nunca use apenas repetição da lista de mensagens como sinal de travamento. Retomar deve reiniciar os contadores de recuperação.
- A coleta consulta metadados nativos antes do filtro de datas e da persistência. Sem data ou texto, tenta novamente três vezes e segue com `status_captura=incompleta` e `campos_ausentes`, sem solicitar retomada manual. Pendências são revisitadas em sobreposições e ao final. Atualizações usam a chave persistida, preservam mídias e movem o registro atomicamente quando a data muda, sem incrementar a contagem. Contêineres vazios sem evidência de mensagem não entram no contador, mas aparecem como `registros_vazios_nao_contados` no relatório. Mídias sem legenda não são tratadas como texto perdido.
- `link_mensagem` guarda o permalink da publicação, separado de `links` (URLs do conteúdo). Em canais, a API combina o código de convite do canal com `MsgModel.serverId` apenas quando o ID da mensagem é único na conversa ativa. Sem metadados confirmados, mantém o campo vazio; não usa o ID interno como número da publicação.
- Reações são uma observação temporal. Preserve a distinção entre total exato, aproximado e indisponível; ausência não equivale a zero.

### Monitoramento e sincronização

`options.mode` é `history` (padrão) ou `monitor` (um canal, mídias obrigatórias). Ao ativar, o coletor posiciona a conversa nas publicações recentes; a API confirma `chat.id` de newsletter e fixa o maior `serverId` como linha de base. Somente IDs posteriores entram no monitoramento. Cada consulta retorna até 100 mensagens novas e revisita até 50 recentes da coleta para atualizar campos disponíveis. `MutationObserver` sinaliza mudanças e uma consulta a cada cinco segundos cobre atualizações sem mutação do DOM. Não há um conjunto de IDs do corpus inteiro no coletor de monitoramento.

O IndexedDB v2 acrescenta índice composto `[job, message.id]` e store `uploads`. A migração mantém as stores existentes. A contagem cresce somente quando um registro é criado; atualizações e correções preservam MID e arquivos. Cursor só avança após persistência do lote. Falta de espaço pausa sem avançar a mensagem bloqueada. O teto padrão de mídias locais é 512 MiB (128–4096 configurável), com limite por arquivo de 256 MiB. O corpus textual permanece no disco; a cota física do perfil continua aplicável.

`DriveSync` envia mídias em série e guarda sessões retomáveis. Cada CSV/índice/relatório tem um ID remoto estável; versões posteriores usam PATCH no mesmo arquivo. O payload de uma sessão pendente é persistido antes do envio e nunca trocado durante a retomada. A geração do retrato pausa brevemente o coletor e espera a transferência atual, mantendo CSV e relatório coerentes; os uploads retomam com a captura liberada. Um alarme de um minuto e os lotes disparam a sincronização; não gere XLSX em cada ciclo. A liberação de Blob local é opcional e somente ocorre após confirmação de ID remoto. ZIPs com cópias liberadas incluem aviso e referências remotas no índice.

A conta é identificada por `about.user.permissionId`, sem escopo adicional. A pasta permanece vinculada à conta original. Renovação silenciosa usa `interactive:false`; falha deixa fila e aviso, sem abrir consentimento automaticamente. Desconectar/revogar bloqueia envios e preserva a captura até o limite. Tokens nunca vão para IndexedDB. Sessão encerrada ou página recarregada exige exportar o parcial e iniciar outra coleta; não prometa continuidade durante fechamento, suspensão ou perda de janela histórica na sessão WhatsApp.

## Validar antes de distribuir

Execute os testes, build e lint após mudanças. Para testar a extensão no navegador com fixtures locais e perfil isolado:

```sh
FIREFOX_BIN=/caminho/para/firefox GECKODRIVER_BIN=/caminho/para/geckodriver npm run test:firefox
```

Instale previamente o geckodriver e substitua os caminhos pelos executáveis locais. Esse teste usa uma API simulada: não comprova compatibilidade com uma sessão WhatsApp real. Siga o [roteiro de testes manuais](TESTES.md) em grupo e canal sob seu controle, comparando CSV, mídias, referências, pausas e exportações parciais. Registre limites em [VALIDACAO.md](VALIDACAO.md).

O envio direto ao Drive está implementado para teste; a validação ponta a ponta exige cliente Google e redirecionamento reais. Siga [GOOGLE_DRIVE.md](GOOGLE_DRIVE.md); não o anuncie como operacional sem validar login e upload. O fluxo OAuth atual é legado e desaconselhado pelo Google para novas aplicações. Tokens ficam somente na sessão; uploads usam blocos de 1 MiB e até quatro tentativas por requisição.

## Empacotar e publicar seu fork

`npm run build` gera em `dist/`:

- `whatsapp-scoop-temporario/` e ZIP temporário: instalação de teste;
- XPI não assinado: pacote para solicitar assinatura à Mozilla;
- ZIP do código-fonte: revisão e reprodução;
- `SHA256SUMS.txt`: hashes dos pacotes.

Os nomes incluem a versão. O build fixa a ordem, as datas e as permissões dos arquivos para permitir reprodução. As bibliotecas e suas licenças seguem dentro do pacote; o pesquisador não precisa instalar dependências.

Antes de distribuir um fork, ajuste nome, autor, site e ID em `extension/manifest.json` e sincronize a versão com `package.json` e o lockfile. Um ID próprio permite instalar o fork sem substituir a extensão original. Se usar Drive, configure um cliente próprio: mudar o ID também muda o redirecionamento OAuth.

A instalação permanente no Firefox comum depende de assinatura. Envie o pacote pelo [portal de extensões Mozilla](https://addons.mozilla.org/developers/), com os fontes e instruções de build quando solicitados. Revise [permissões e privacidade](PRIVACIDADE.md) e teste o pacote assinado antes de disponibilizá-lo.

Preserve a licença **GPL-3.0** e a atribuição original a [douglasferreira](https://douglasferreira.me). zip.js usa BSD-3-Clause e WA-JS usa Apache-2.0 e @noble/hashes usa MIT; mantenha os arquivos de licença incluídos. A [logo](branding/README.md) e seus ícones ficam no repositório.
