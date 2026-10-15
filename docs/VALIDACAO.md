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

## Versão 0.2.0 — API da sessão para mídias

29 testes automáticos aprovados e lint desktop sem avisos ou erros. Teste Waterfox 153.4.0 em perfil descartável aprovado: 35 mensagens, 6 arquivos, 1 falha deliberada, ZIP, vínculos MID, links, reações, pausa/retomada e canal parcial. Nesta execução a API WPP foi simulada na página; funções reais de `browser.scripting.executeScript` executaram o protocolo de leitura/transferência em MAIN. Isso verifica a integração da extensão e a transferência de bytes, **não** a resolução dos módulos do WhatsApp real pela biblioteca WA-JS.

Na sessão real, o usuário relatou que precisou primeiro carregar o vídeo manualmente para abri-lo. Inspeção confirmou o controle interno `media-url-provider`, ausência inicial de `video` no histórico não carregado, e vídeo aberto com origem `blob` e botões Baixar/Fechar. Os logs da versão 0.1.3 confirmaram 4 mídias com erro e nenhum arquivo recuperado. A versão 0.2.0 adiciona WA-JS 4.6.1, download pela sessão autenticada e fallback DOM com sequência de eventos no elemento interno. A obtenção automática de mídia via WA-JS nesse canal real ainda precisa de confirmação; não é apresentada como validada.

## Versão 0.3.0 — XLSX opcional e organização dos arquivos

33 testes automatizados aprovados. Novos testes verificam CSV/XLSX com pseudônimos consistentes, datas e contagens numéricas, zero versus informação ausente, caracteres especiais, texto iniciado por fórmula mantido como texto, referências MID, links relativos para mídias, exportação vazia, textos acima do limite de célula preservados em partes e divisão em abas. O modo padrão não chama o gerador XLSX, inclusive em coletas antigas sem essa opção.

Waterfox 153.4.0 em perfil descartável: opção XLSX desmarcada inicialmente; coleta de grupo sintético com 35 mensagens, 6 mídias e 1 falha deliberada; exportação de ZIP com CSV, XLSX e JSONs em `.system/`. Conferidos filtros, células numéricas, pseudônimos e referências MID no XLSX. Canal sintético: encerramento parcial com 10 mensagens, XLSX e relatório fiel à interrupção.

Um leitor independente (openpyxl 3.1.5, somente leitura) abriu o XLSX de exemplo sintético e confirmou datas, contagens, filtros, congelamento, links de mídia, ausência de fórmulas e preservação de texto longo com emoji. Prévias das abas Resumo, Mensagens e Mídias foram renderizadas e inspecionadas. Lint desktop sem erros ou avisos.

A exportação direta para o Google Drive continua em implementação e validação. A reorganização `.system/` e a opção XLSX também estão previstas nesse fluxo, mas login e upload reais continuam pendentes. Estes testes não comprovam compatibilidade com todas as variantes do WhatsApp nem grandes corpora em um computador de pesquisador.

## Versão 0.3.1 — links permanentes das mensagens

35 testes automatizados aprovados e lint desktop sem erros ou avisos. O CSV e o XLSX incluem `link_mensagem`, distinto dos links do conteúdo. A API usa código do canal e `serverId` confirmado, com verificação da conversa e unicidade do ID. IDs internos, mensagens ambíguas e metadados ausentes não geram URLs inferidas. Waterfox 153.4.0, perfil descartável: link permanente verificado no CSV de canal sintético por API simulada. A disponibilidade desses metadados em canais reais continua dependente da sessão.

A contagem foi conferida nos arquivos locais apresentados pelo usuário: 117 registros no CSV e 117 mensagens no relatório. O arquivo tem 310 linhas de texto por causa de cabeçalho e quebras internas; 38 registros não têm texto/legenda. Isso confirma a correspondência nesses arquivos, mas a comparação com o número visto no painel depende da informação do usuário. O painel e o README explicam a diferença entre registros e linhas físicas.

## Versão 0.3.2 — proteção contra registros incompletos

A investigação dos arquivos fornecidos confirmou 38 registros no final do CSV com os campos de data, remetente, texto, legenda e links vazios: 30 associados a mídias e 8 classificados como texto sem conteúdo. A concordância de 117 registros com o contador não comprovava completude dos campos. Esses arquivos antigos não foram alterados.

A coleta agora consulta a sessão antes do filtro de datas para recuperar texto, legenda e horário quando disponíveis. Mensagens reconhecidas que continuem sem data ou texto passam por três tentativas e causam pausa explícita, em vez de uma exportação silenciosamente incompleta. Retomar reinicia as tentativas. Contêineres vazios sem evidência de mensagem são excluídos do contador e registrados no relatório; IDs nativos e mensagens confirmadas pela sessão não são descartados por estarem incompletos. Mídias sem legenda continuam válidas.

37 testes automatizados aprovados. Teste Waterfox 153.4.0 com dados sintéticos: recuperação de texto/data ausentes no DOM pela API, links permanentes, contêiner vazio não contado, pausa por metadados indisponíveis e retomada após disponibilizá-los, com 35 mensagens preservadas e ZIP padrão sem XLSX. Coletas com XLSX e canal parcial também verificadas. Lint desktop sem erros ou avisos. Os módulos WhatsApp reais e mudanças futuras podem impedir a recuperação; nesse caso, a proteção pausa e permite exportação parcial explícita.

## Versão 0.3.3 — recuperação da rolagem

A pausa observada pelo usuário correspondia à regra antiga de oito ciclos com a mesma lista de identificadores. Essa regra não distinguia uma rolagem ainda em movimento de um travamento. A nova detecção considera posição, altura e registros novos, relocaliza o contêiner após capturar mídias e faz três tentativas de recuperação antes de pausar. Continuar reinicia o estado dessa detecção. Indicadores de carregamento adiam a decisão; espera prolongada resulta em pausa, não em declaração de histórico completo.

39 testes automatizados aprovados e lint desktop sem erros ou avisos. Waterfox 153.4.0, perfil descartável: histórico sintético com um trecho de 5.000 pixels que exige mais de oito ciclos com IDs inalterados; a coleta alcançou as 35 mensagens e 6 mídias, com 1 falha deliberada. Conferidos encerramento parcial, proteção dos metadados, retomada e CSV/XLSX. A conclusão continua sendo um limite observado, sem garantir a primeira mensagem histórica de um canal real.

## Versão 0.3.4 — pendências sem interrupção manual

O usuário mostrou pausas repetidas na proteção de metadados, apesar de mídias recuperadas sem falha. A versão substitui essa pausa por três tentativas automáticas e continuidade com pendências explícitas. CSV e XLSX incluem `status_captura` e `campos_ausentes`; painel e relatório apresentam as contagens. Sobreposições e uma última consulta no fim tentam recuperar campos; atualizações preservam referências às mídias, alteram a chave cronológica atomicamente e não incrementam o total de mensagens.

41 testes automatizados aprovados, incluindo classificação de pendências e atualização sem duplicação nem perda de mídia. Teste Waterfox 153.4.0 aprovado: uma mensagem permaneceu sem texto e data, e a coleta alcançou as 35 mensagens sem pedir Continuar. Exportou 1 pendência identificada no CSV e no relatório, mantendo o aviso após iniciar o download. Lint desktop sem erros ou avisos. Campos realmente indisponíveis não são inventados nem apresentados como recuperados.

## Monitoramento e Google Drive · 0.4.0

15 de outubro de 2026. Monitoramento de um canal com mídias, índice persistido por ID, cursor de novas publicações, observação de alterações e consulta periódica. A pasta no Drive mantém os mesmos IDs de CSV/índice/relatório; mídias são enviadas em série, com fila local e liberação opcional somente após confirmação. Sem servidor nem segredo Google no pacote.

48 testes automatizados cobrem também linha de base e paginação de novas mensagens, atualização do mesmo arquivo via PATCH, renovação silenciosa e troca de conta, sessão retomável expirada, falha/reenvio sem perda de bytes, liberação após confirmação, ZIP com referências remotas, hash incremental e migração preservando dados da versão anterior. Lint desktop sem erros ou avisos. Auditoria das dependências de produção sem vulnerabilidades conhecidas na data da conferência.

Waterfox 153.5.0, em perfil isolado: histórico sintético com 35 mensagens, seis mídias e uma falha deliberada; canal parcial; monitoramento que exclui o histórico anterior e captura duas mensagens novas, incluindo uma foto, atualiza texto e contagem de interações sem aumentar os registros, pausa diante de arquivo acima do limite sem avançar o cursor e exporta um ZIP com os MIDs correspondentes. Os testes usam API WhatsApp simulada e não comprovam continuidade numa conta real.

**Google Drive real ainda pendente:** o mantenedor informou que criará o Client ID seguindo o guia. Login, aceitação do redirecionamento e upload na conta precisam ser conferidos antes de considerar a integração validada ponta a ponta. Testes simulados não substituem essa validação. Suspensão, fechamento, recarga e troca de canal podem deixar lacunas; não há serviço de monitoramento quando o navegador está fechado.

## Aba do WhatsApp em segundo plano · 0.4.0

15 de outubro de 2026. Waterfox 153.5.0, perfil isolado e configuração padrão de temporizadores. Durante 80 segundos, uma página comum permaneceu ativa; a aba da conversa sintética permaneceu com `document.hidden=true`, sem receber foco. O monitoramento capturou três mensagens novas, duas com mídia (foto e áudio), com zero falhas. A última publicação foi programada após 65 segundos e também foi capturada. A versão 0.4.0 já permite esse comportamento; nenhuma mudança no código da extensão foi necessária. Resultado: [firefox-background-result.json](firefox-background-result.json).

O teste comprova esse cenário sintético, sem prometer monitoramento quando a aba é descarregada, o computador dorme ou a sessão WhatsApp deixa de disponibilizar mensagens. O navegador pode reduzir a frequência de temporizadores em segundo plano, conforme a [documentação de visibilidade da Mozilla](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API).

## Correção de rede Google Drive · 0.4.1

15 de outubro de 2026. Corrigida a chamada de `fetch` armazenada no cliente Drive: o receiver agora permanece vinculado ao contexto global Window exigido pelo Firefox. A falha ocorria ao validar a autorização após o retorno do login e também afetava outras chamadas ao Google. A correção não altera Client ID, redirecionamento, escopos ou dados temporários.

49 testes automatizados aprovados e lint desktop sem erros ou avisos. Waterfox 153.5.0, perfil isolado: reproduzido o erro original com fetch desvinculado; o cliente corrigido passou com fetch nativo. Validação de token/conta, criação de pasta, upload e PATCH do mesmo CSV conferidos com respostas Google simuladas em servidor local, sem conta ou token reais. Resultado em [firefox-drive-result.json](firefox-drive-result.json). A validação de login e upload numa conta Google real continua pendente; a integração permanece restrita a testes.

## Client ID incluído e configuração automática · 0.4.2

15 de outubro de 2026. O pacote oficial inclui o Client ID público informado pelo mantenedor, sem segredo de cliente nem tokens. Pesquisadores autorizados para teste precisam apenas conectar a própria conta. Configurações avançadas permitem substituir o ID para aplicativos próprios ou forks e restaurar o padrão sem apagar coletas. O aplicativo Google continua em modo de teste; incluir o ID não libera outras contas.

49 testes automatizados aprovados; lint desktop sem erros ou avisos. Waterfox 153.5.0, perfil isolado: instalação nova reconhece o ID incluído; substituição tem prioridade e persiste após recarregar o painel; o botão de restauração recupera o padrão; ID inválido é recusado sem alterar a configuração. Fetch nativo e OAuth/uploads simulados continuam aprovados. Resultado em [firefox-drive-result.json](firefox-drive-result.json). O teste não utiliza o Client ID real para autenticar nem acessa uma conta Google real.

## Workbook e compatibilidade das abas · 0.4.3

15 de outubro de 2026. Renomeado para `workbook.xlsx`, incluindo ZIP, Drive e relatório. A opção continua facultativa e avisa sobre tempo adicional. As abas de mensagens e mídias eram gravadas por stream de tamanho desconhecido, que ativava ZIP64, enquanto Resumo usava entradas com tamanho conhecido. O novo escritor fornece tamanho e CRC nos cabeçalhos ZIP convencionais e declara a área preenchida de todas as abas.

50 testes automatizados aprovados, incluindo regressão dos cabeçalhos locais, dimensões, paginação, textos longos e 125 mensagens persistidas no IndexedDB presentes no workbook. Lint desktop sem erros/avisos. LibreOffice 26.8.1.1, executado localmente com perfil temporário e dados sintéticos: três mensagens e uma mídia preservadas nas abas correspondentes após importação. A amostra anterior também foi lida nessa versão; portanto, o sintoma específico do usuário não foi reproduzido nesse leitor. A mudança elimina a diferença de empacotamento e reforça a compatibilidade. Google Planilhas ainda não foi conferido. Resultado em [workbook-reader-result.json](workbook-reader-result.json). Nenhum corpus real foi enviado a serviços externos.
