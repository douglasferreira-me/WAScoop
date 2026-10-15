# Validação e roteiro de teste

## Automatizado

Execute `npm test`, `npm run build` e `npm run lint`. Os testes cobrem deduplicação, datas, CSV/XLSX, filtros e tipos de célula, textos longos, pseudônimos, associação de arquivos, ZIP, persistência e uploads com respostas simuladas. O empacotamento inclui todas as dependências executadas no navegador; nenhum script remoto é carregado.

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

## Monitoramento e Drive

1. Num canal de teste, ative monitoramento e confirme que nenhuma publicação anterior entra na contagem. Publique texto com links, foto, vídeo, áudio, documento e figurinha; compare os arquivos e seus MIDs.
2. Confirme após duas sincronizações que existe apenas um `mensagens.csv` na pasta, com o mesmo ID e as novas linhas. Confira `.system/` e a correspondência entre mensagem, MID e mídia.
3. Desconecte a rede e depois a conta Google: novas mensagens devem ficar locais, com aviso e pendências. Reconecte a mesma conta e confirme retomada sem arquivos repetidos. A tentativa de outra conta deve ser recusada para a coleta ativa.
4. Ative liberação de cópias locais e confirme que só arquivos com ID remoto perdem Blob. Confira que o ZIP informa as referências remotas. Desative e confirme ZIP com mídias locais.
5. Simule o limite local e arquivo acima de 256 MiB: a captura deve pausar sem avançar o cursor da mensagem bloqueada. Exporte o parcial; registre a possível lacuna.
6. Troque de canal, recarregue, feche o navegador e suspenda o computador. Nenhum desses casos comprova continuidade; confirme aviso, preservação e relato de interrupção.

## Conversa em segundo plano

Para executar somente a conferência com uma página comum ativa:

```sh
SCOOP_BACKGROUND_ONLY=1 FIREFOX_BIN=/caminho/para/firefox GECKODRIVER_BIN=/caminho/para/geckodriver npm run test:firefox
```

O teste mantém uma página comum ativa por 80 segundos e programa três mensagens na API sintética da conversa oculta, incluindo foto e áudio. A última chega após 65 segundos, além do período inicial de possíveis restrições de temporizadores. Confere `document.hidden`, captura das mídias, contagens e ausência de mudança do foco para a conversa. O resultado fica em `firefox-background-result.json`. Não desativa as restrições de segundo plano do navegador e não comprova operação com a aba descarregada ou computador suspenso.

## Rede do Drive no Firefox

```sh
SCOOP_DRIVE_ONLY=1 FIREFOX_BIN=/caminho/para/firefox GECKODRIVER_BIN=/caminho/para/geckodriver npm run test:firefox
```

Confere o seletor de idioma acima do cabeçalho, alternância Português/English, persistência após recarga, progresso, números e preservação do nome da conversa. Confere o Client ID incluído em instalação nova, substituição persistente para forks, restauração pelo painel e rejeição de ID inválido. Reproduz o erro de receiver de `Window.fetch`, confere o cliente corrigido com fetch nativo e exercita validação OAuth, pasta, upload e atualização com endpoints Google simulados num servidor local. A fixture roda como módulo real na página da extensão, pois o sandbox de scripts do WebDriver tem contexto global diferente. Nenhuma credencial real é usada ou enviada ao Google. O resultado fica em `firefox-drive-result.json`; essa fixture não é incluída no pacote distribuído.

## Compatibilidade das abas XLSX

Na exportação de histórico com workbook marcado, confirme `workbook.xlsx` no ZIP, a mesma quantidade de mensagens do CSV e os MIDs na aba Mídias. Abra todas as abas no LibreOffice ou Excel e confira uma amostra. Os testes do escritor inspecionam também os cabeçalhos ZIP locais, CRC/tamanhos conhecidos e dimensões das abas para evitar depender apenas de um descompactador tolerante. Para conferência independente, um leitor instalado pode converter uma fixture sintética para ODS; compare conteúdo e contagens. O registro da versão 0.4.3 fica em `workbook-reader-result.json`.

## Estado de validação

Resultados desta implementação serão registrados em `docs/VALIDACAO.md`. Testes sintéticos e lint não substituem validação em uma conta WhatsApp real. O Drive não é validado ponta a ponta sem Client ID e conta Google autorizada.
