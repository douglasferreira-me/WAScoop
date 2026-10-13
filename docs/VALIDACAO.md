# Validação da versão 0.1.0

Data: 13 de outubro de 2026.

## Comprovado

- **15 testes automatizados passaram**: grupos/canais sintéticos, mensagens repetidas com e sem identificadores, corte de novas mensagens, datas, campos ausentes, CSV, pseudônimos, paginação/persistência no IndexedDB, associação de mídias, ZIP e cliente OAuth/upload Google com respostas simuladas.
- **Firefox 158.0 real, perfil isolado**: instalação temporária, painel, rolagem de grupo sintético com sobreposição, 35 mensagens, cinco mídias com bytes correspondentes às fontes sintéticas e uma mídia indisponível registrada como falha.
- Pausa, tentativa de continuar em conversa diferente, retomada na conversa original, download de ZIP pelo Firefox e conferência de seu CSV, relatório e conteúdo das mídias.
- Canal sintético: encerramento parcial com dez mensagens, sem mídias, segundo ZIP e recuperação da coleta persistida.
- Análise do manifesto/código com `web-ext`: nenhum erro ou aviso aplicável ao Firefox desktop. Avisos exclusivamente sobre versões Android são explicitamente filtrados; o projeto não suporta Android.
- Pacotes reproduzíveis, biblioteca ZIP incluída localmente e hashes SHA-256 dos artefatos.

O teste Firefox usa uma cópia da extensão com duas adaptações **somente para teste**: origem da conversa em servidor local e `saveAs=false` para dispensar o diálogo nativo de arquivo. O pacote entregue mantém WhatsApp Web e o diálogo de escolha de destino. O resultado detalhado está em [firefox-fixture-result.json](firefox-fixture-result.json).

## Ainda não comprovado

- Coleta em grupo/canal de uma conta WhatsApp real: depende de uma sessão e de conversas autorizadas para teste. Os seletores são heurísticos e sujeitos a mudanças; o pacote deve ser tratado como beta até essa conferência.
- Login e upload no Google Drive de ponta a ponta: `extension/config.json` tem Client ID vazio. O código e os testes simulados estão implementados, mas falta cadastrar e validar o aplicativo Google real.
- Assinatura Mozilla e instalação permanente: o XPI entregue é **não assinado**.
- Fidelidade de áudio/vídeo eventualmente transformados pelo WhatsApp: o índice distingue bytes de reprodução de download pelo visualizador. A suíte compara as fontes sintéticas, não arquivos de uma sessão real.
- Corpus de grande volume ou retomada de upload após expiração da sessão no próprio Google.

O roteiro para completar esses testes está em [TESTES.md](TESTES.md). Nenhuma dessas pendências é apresentada na interface como funcionalidade já verificada em uma conta real.

## Atualização visual 0.1.1

A versão 0.1.1 acrescenta a logo original do balão pesquisador com lupa, ícones PNG em sete tamanhos e a marca no README do GitHub. O painel usa a nova fonte SVG. O comportamento de coleta permanece o da versão 0.1.0; a revisão visual, o empacotamento e a análise dos ícones/manifesto são realizados para a nova versão.

## Versão 0.1.2 — diagnóstico e navegação

19 testes automáticos aprovados, incluindo não clicar em imagem dentro de link, não classificar prévia de link como mídia, restauração dos interceptadores e recuperação do log quando o download falha. Validação do pacote Firefox sem erros ou avisos desktop. A correção restringe a abertura a controles de mídia reconhecidos; quando não reconhecidos, registra uma falha sem usar miniaturas. Não foi validada em uma sessão real Waterfox/WhatsApp; o relatório fornecido pelo usuário mostrou uma coleta pausada com 3 mensagens, 0 mídias e 1 falha.

## Versão 0.1.3 — mídias, referências, links, reações e logo

25 testes automáticos aprovados e lint desktop sem erros ou avisos. Teste no Waterfox 153.4.0, em perfil descartável, aprovado com 35 mensagens e 6 arquivos recuperados (foto, documento, áudio, vídeo e figurinha), além de 1 mídia deliberadamente indisponível. Inclui duas fotos com bytes idênticos, com identificadores distintos. Verificadas referências `MID` no CSV, índice e nomes dos arquivos, links com parâmetros e total exato de reações. Coleta parcial de canal com 10 mensagens, pausa/retomada e download de diagnóstico antes e depois da coleta aprovados.

As conversas deste teste são sintéticas e locais. O formato acessível de contagem de reações foi observado na interface real do canal, mas o download de todas as mídias desse canal ainda depende de confirmação com a sessão real. Não houve teste de credenciais Google Drive. O pacote não apresenta mídia indisponível como recuperada.

## Versão 0.1.4 — logo do pesquisador

Alteração visual: balão com carinha de óculos e sorriso. PNG de 512 pixels inspecionado, ícones gerados do mesmo SVG e pacotes reconstruídos. Lint desktop sem erros ou avisos. Código de coleta permanece igual ao da versão 0.1.3; os testes funcionais documentados acima correspondem a essa implementação.
