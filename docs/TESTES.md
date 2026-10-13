# Validação e roteiro de teste

## Automatizado

Execute `npm test`, `npm run build` e `npm run lint`. Os testes cobrem deduplicação, datas, CSV, pseudônimos, associação de arquivos, ZIP, persistência e uploads com respostas simuladas. O empacotamento inclui todas as dependências executadas no navegador; nenhum script remoto é carregado.

`npm run test:firefox` executa a extensão em um perfil isolado com fixtures locais de grupo e canal. Defina `FIREFOX_BIN` e `GECKODRIVER_BIN` apontando para os binários oficiais da Mozilla. O teste altera **somente na cópia temporária** a origem da conversa e `saveAs=false` para evitar o diálogo de download. Exercita rolagem, mídia, pausa/retomada, mudança de conversa, ZIP real, encerramento parcial e recuperação do IndexedDB. Não comprova funcionamento numa sessão WhatsApp real nem valida OAuth Google. Seu resultado fica em `docs/firefox-fixture-result.json`.

## Firefox real, com grupo/canal de teste

Use conversas sob seu controle e não comite dados pessoais. Instale temporariamente o pacote seguindo o README.

1. Crie um grupo com mensagens antigas suficientes para ultrapassar várias telas. Inclua mensagens iguais, emoji, aspas, vírgulas, quebras de linha, respostas e encaminhamentos.
2. Inclua foto, vídeo, áudio, PDF e figurinha. Faça uma coleta sem mídias e outra com mídias. Abra os arquivos exportados e compare com os originais; confirme hashes e associações.
3. Repita em um canal. Confira reconhecimento de datas e legendas. Não aceite a contagem de uma amostra incompleta como prova de coleta integral.
4. Teste intervalo de datas, datas desconhecidas e pseudônimos. Confira que campos ausentes ficam vazios e conteúdo citado não desaparece.
5. Pause/continue, troque de conversa, feche/recarregue a aba e encerre antes do fim. Confira exportação parcial e motivo no relatório.
6. Cancele o download ZIP e tente Exportar ZIP novamente. Reinicie o navegador e teste recuperação com as limitações da instalação temporária.
7. Com um cliente Google configurado, negue consentimento, autorize, faça upload, simule perda de conexão/expiração e reconecte. Confira os arquivos na pasta, as tentativas limitadas e o ZIP local de recuperação.
8. Antes de assinar, execute a revisão de permissões e teste o XPI assinado num perfil limpo. A assinatura não comprova a fidelidade do corpus.

## Estado de validação

Resultados desta implementação serão registrados em `docs/VALIDACAO.md`. Testes sintéticos e lint não substituem validação em uma conta WhatsApp real. O Drive não é validado ponta a ponta sem Client ID e conta Google autorizada.
