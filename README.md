<p align="center">
  <img src="docs/branding/logo.png" width="176" alt="Logo Whatsapp Scoop: um balão pesquisador sorridente com óculos e uma lupa">
</p>

# Whatsapp Scoop

**Uma extensão Firefox para transformar o histórico acessível de um grupo ou canal do WhatsApp em material de pesquisa.** Produzida por [douglasferreira](https://douglasferreira.me).

Você abre a conversa no WhatsApp Web, inicia a coleta e recebe uma planilha CSV. Se marcar **Incluir mídias**, o mesmo ZIP terá uma pasta com os arquivos que o WhatsApp conseguir disponibilizar. Também há envio opcional ao seu Google Drive.

> **Versão beta.** O WhatsApp muda sua interface sem aviso. A extensão não recupera mensagens que sua conta não consegue acessar, não recupera arquivos expirados e não garante que o histórico inteiro da conversa esteja disponível. O relatório informa o que foi observado e o que falhou. A ferramenta não decide se uma mensagem é desinformação.

## Quero testar agora, antes da assinatura

Você **não precisa instalar Python nem aprender programação** para usar o pacote pronto. Use Firefox para computador, versão **140 ou posterior**.

1. Baixe [`whatsapp-scoop-0.1.4-temporario.zip`](https://github.com/douglasferreira-me/WAScoop/releases/download/v0.1.4-beta/whatsapp-scoop-0.1.4-temporario.zip) na [versão beta](https://github.com/douglasferreira-me/WAScoop/releases/tag/v0.1.4-beta). Se você está na pasta do projeto, ele está dentro de `dist/`.
2. Extraia o ZIP em uma pasta. Não tente instalá-lo como uma extensão permanente.
3. No Firefox para computador, digite **`about:debugging`** na barra de endereço.
4. Clique em **Este Firefox** e depois em **Carregar extensão temporária**.
5. Abra a pasta extraída e selecione **`manifest.json`**.
6. Abra [WhatsApp Web](https://web.whatsapp.com), faça seu login normalmente e **recarregue a página** se ela já estava aberta quando você instalou a extensão.
7. Clique no ícone **Whatsapp Scoop** na barra do Firefox. Se estiver escondido, procure no botão de extensões. O painel também pode ser aberto pelo menu de painéis laterais do Firefox.

**Essa instalação é temporária:** depois de fechar e reabrir o Firefox, repita os passos 3–5. Exporte sua coleta antes de reiniciar ou remover a extensão. Dados de uma instalação temporária podem deixar de estar acessíveis depois disso.

A pasta `dist/whatsapp-scoop-temporario/` já está descompactada para quem recebeu o projeto completo: basta selecionar seu `manifest.json`.

## Como fazer uma coleta

1. Abra o **grupo ou canal** desejado no WhatsApp Web. Uma coleta trabalha com uma conversa por vez.
2. No painel, clique em **Atualizar** e confira o nome da conversa.
3. Deixe as datas vazias para buscar todo o histórico acessível ou escolha as datas inicial e final.
4. Marque **Incluir mídias** se precisar dos arquivos. Isso aumenta o tempo e o espaço necessário.
5. Opcionalmente, marque **Usar pseudônimos para remetentes**. Isso troca nomes e números nos campos de identificação, mas **não apaga informações pessoais escritas nas mensagens nem contidas nas mídias**.
6. Mantenha **Baixar um ZIP no computador** e clique em **Iniciar coleta**.
7. Deixe a aba aberta e evite interagir com a conversa durante a coleta. Você verá a rolagem, as contagens e o período alcançado. O total de mensagens não é conhecido antecipadamente, então não há uma porcentagem inventada.
8. Ao terminar, escolha onde salvar o ZIP. Você também pode clicar em **Pausar**, **Continuar** ou **Encerrar e exportar** para obter um resultado parcial.

Se você mudar de conversa, a coleta pausa. Volte à conversa original para continuar. Se recarregar ou fechar a aba, exporte o material preservado e inicie outra coleta. Para exportar sem encerrar, pause e clique em **Exportar ZIP**.

## O que vem no ZIP?

| Arquivo | Para que serve |
| --- | --- |
| `mensagens.csv` | Uma linha por mensagem coletada, com texto, datas, remetente e referências às mídias. |
| `midias/` | Arquivos originais acessíveis, se a opção foi marcada e o download funcionou. |
| `indice_midias.json` | Relação entre mensagens e arquivos, tamanho, formato e impressão digital SHA-256. |
| `relatorio_coleta.json` | Versão da ferramenta, período, contagens, interrupções, falhas e informações para sua metodologia. |

Abra o CSV no Excel, LibreOffice ou importe no Google Planilhas. Se ele não separar as colunas corretamente, use **Importar texto/CSV**, selecione **UTF-8** e separador **vírgula**. Textos com vírgulas, aspas e quebras de linha são preservados dentro das células.

Datas reconhecidas são exportadas no padrão ISO, em UTC. A interpretação original usa o idioma do WhatsApp e o fuso do computador; o campo `data_original` guarda a informação observada. Campos sem informação ficam vazios. Com filtro de datas, mensagens cuja data não foi reconhecida são excluídas e contadas no relatório.

Por segurança ao abrir em planilhas, campos que começam com sinais de fórmula recebem um apóstrofo inicial. Para análise textual que exija a string original, remova **um** apóstrofo apenas quando ele anteceder `=`, `+`, `-`, `@`, tabulação ou retorno de carro. A regra é registrada no relatório.

## Quero enviar para o Google Drive

Quando o mantenedor tiver configurado o login do projeto:

1. Escolha **Enviar a uma pasta no Google Drive**.
2. Clique em **Conectar ao Google Drive**. Autorize as permissões do Firefox e escolha sua conta na página do Google.
3. Inicie a coleta. A extensão cria uma pasta própria e envia as mídias conforme são obtidas.
4. Ao encerrar, ela envia o CSV, o índice e o relatório. O painel oferece o link para abrir a pasta.

**Pesquisadores não precisam criar projetos no Google nem preencher credenciais.** Se aparecer “Login ainda não configurado pelo mantenedor”, use ZIP local; o botão não oferece um login fictício. Somente o responsável pela distribuição precisa fazer a configuração descrita em [Google Drive para mantenedores](docs/GOOGLE_DRIVE.md).

Os arquivos vão da extensão diretamente ao seu Drive. A autorização fica somente na memória durante a sessão, sem guardar senha ou token no disco. Ela pode expirar durante uma coleta longa: reconecte e clique em **Continuar**, ou em **Finalizar envio ao Drive** se a coleta já terminou. O material local continua disponível para ZIP. A desconexão na extensão remove o token local; a revogação permanente pode ser feita nas configurações de acesso da sua conta Google.

O login direto escolhido usa um fluxo OAuth legado, atualmente desaconselhado pelo Google para aplicações novas. Ele evita uma hospedagem própria, mas pode deixar de ser aceito no futuro. [Explicação e configuração](docs/GOOGLE_DRIVE.md).

## Limites importantes para a pesquisa

- A coleta reproduz o histórico que a interface consegue mostrar. “Limite observado” significa que a rolagem deixou de revelar mensagens; não prova que a primeira mensagem histórica foi recuperada.
- Mensagens novas após o início não fazem parte do objetivo da coleta. A ferramenta usa horário e sobreposição das telas como corte; mensagens sem identificador ou horário preciso exigem conferência no corpus.
- Mensagens com data reconhecida são ordenadas cronologicamente. As sem data ficam ao final, identificadas no CSV; sua posição não permite afirmar cronologia exata.
- Grupos e canais têm estruturas distintas. Se a interface mudar e não for reconhecida, a ferramenta deve interromper ou pausar; confira as amostras antes de adotar o corpus em um artigo.
- Arquivos apagados, expirados ou protegidos não são reconstruídos. A ferramenta não contorna restrições de acesso ou visualização única. Miniaturas não são exportadas como se fossem originais. O índice distingue download pelo visualizador de áudio/vídeo obtidos dos bytes acessíveis para reprodução; compare estes últimos com um download manual se a fidelidade de formato for importante para sua análise.
- Identificadores do WhatsApp são usados quando expostos na página. Sem eles, a extensão usa sobreposição de conteúdo e posição. Sequências indistinguíveis de mensagens repetidas podem ser ambíguas; o relatório sinaliza identificadores inferidos.
- Pseudônimos são consistentes **dentro da coleta**, não entre coletas. Eles não tornam o corpus inteiro anônimo.
- ZIPs grandes ainda dependem da memória e do espaço disponíveis no navegador. Se ocorrer falha, encerre uma coleta menor usando intervalo de datas; os dados já salvos não são descartados automaticamente.
- Não há telemetria nem análise automática do conteúdo. O único envio externo do corpus acontece quando você escolhe Google Drive.

Na metodologia, registre as datas, a versão, o intervalo solicitado, a conta com acesso ao grupo/canal e as falhas do relatório. Revise dados pessoais antes de compartilhar o corpus ou publicar exemplos.

Exemplo de referência: **douglasferreira. Whatsapp Scoop, versão 0.1.3. Disponível em https://github.com/douglasferreira-me/WAScoop. Coleta realizada em [data].**

## Algo não funcionou

| Situação | O que tentar |
| --- | --- |
| A conversa não aparece | Abra a conversa, recarregue o WhatsApp Web após instalar e clique em Atualizar. |
| A coleta pausou ao trocar de conversa | Volte à conversa original e clique em Continuar. |
| A página foi recarregada ou fechada | Encerre e exporte o material parcial; depois inicie outra coleta. |
| A mídia falhou | Consulte o relatório. Pode estar indisponível ou ter um controle de download que a versão ainda não reconhece. |
| O login Google falhou | Verifique se o mantenedor configurou o aplicativo e o redirecionamento. ZIP local continua disponível. |
| O Google expirou ou perdeu conexão | Reconecte; a mídia local permanece preservada. |
| O download foi cancelado | Clique em Exportar ZIP para tentar novamente. |
| Reiniciei o navegador | Reinstale temporariamente, se necessário, e tente Recuperar última coleta. Não conte com recuperação após desinstalação. |

## Para desenvolver ou fazer um fork

O código usa JavaScript/HTML/CSS porque a extensão precisa operar dentro do Firefox. Python é usado no empacotamento, sem precisar ser instalado pelo pesquisador. Não há Baileys, servidor nem acesso a bancos privados internos do WhatsApp.

Requisitos do mantenedor: Node.js 22 ou posterior, npm, Python 3 e Firefox desktop 140 ou posterior.

```sh
git clone git@github.com:douglasferreira-me/WAScoop.git
cd WAScoop
npm ci
npm test
npm run build
npm run lint
npm start
```

O pacote pronto já inclui a biblioteca ZIP. `npm ci` só é necessário para desenvolver ou reconstruir. As dependências têm versões travadas no `package-lock.json`. O empacotamento fixa ordenação, permissões e datas dos arquivos para gerar pacotes reproduzíveis e publica seus hashes em `dist/SHA256SUMS.txt`.

### Organização

- `extension/content/`: adaptadores da interface e rolagem/coleta; recuperação de download original por um hook temporário específico do Firefox.
- `extension/lib/`: funções puras, armazenamento IndexedDB, CSV/ZIP e cliente Drive.
- `extension/background.js`: coordenação, persistência e exportação. `panel.html`, `panel.css` e `panel.js`: interface.
- `scripts/build.py`: empacotamento. `tests/`: dados sintéticos e verificações automatizadas. `docs/`: configuração e testes manuais.

Os adaptadores devem ser atualizados com amostras sintéticas que reproduzam mudanças no WhatsApp, sem incluir conversas reais no Git. As mensagens passam do content script ao background em lotes; mídias usam blocos de 256 KiB e ficam como Blobs no IndexedDB. O upload ao Drive usa blocos de 1 MiB, reconciliação de posição e até quatro tentativas por requisição.

As permissões estão explicadas em [PRIVACIDADE.md](docs/PRIVACIDADE.md). A validação real e o roteiro de regressão estão em [TESTES.md](docs/TESTES.md). Uma suíte sintética não comprova compatibilidade com todas as variantes atuais do WhatsApp. A extensão usa o sistema nativo de consentimento de dados do Firefox 140+, exigido pela Mozilla para novas extensões; o envio ao Drive pede consentimento opcional e sua revogação interrompe envios.

### Pacote temporário e assinatura

`npm run build` produz:

- `dist/whatsapp-scoop-temporario/`: instalação temporária descompactada.
- `dist/whatsapp-scoop-0.1.4-temporario.zip`: o mesmo pacote em ZIP.
- `dist/whatsapp-scoop-0.1.4-nao-assinado.xpi`: pacote para enviar à Mozilla; **não instala permanentemente no Firefox comum antes de assinar**.
- `dist/whatsapp-scoop-0.1.4-codigo-fonte.zip`: fonte para revisão/reprodução.

Para distribuir permanentemente, envie o XPI para assinatura no [portal de extensões Mozilla](https://addons.mozilla.org/developers/), junto com o código-fonte quando solicitado. Configure o login Google antes de oferecer Drive como funcional. A assinatura, a publicação e a validação OAuth dependem das contas do mantenedor.

O projeto mantém a licença **GPL-3.0** já presente no repositório. A biblioteca zip.js tem licença BSD-3-Clause, incluída no pacote em `extension/vendor/LICENSE.zipjs`.

Confira [o que foi validado e o que ainda depende de teste real](docs/VALIDACAO.md) antes de usar o corpus como base de um artigo.

A [logo original do projeto](docs/branding/README.md) combina um balão de conversa curioso com uma lupa. Ela está no painel, nos ícones do Firefox e no topo deste README.

### Diagnóstico e coleta pausada

O botão **Baixar log de diagnóstico** fica disponível mesmo sem coleta ou após sucesso. Se o download falhar, abra **Ver ou copiar o log** e copie o texto. Envie o JSON ou o texto ao pedir ajuda. Ele contém versão, etapas, contagens e erros, sem incluir o conteúdo das mensagens, nomes da conversa ou credenciais. Não há envio automático. Os últimos 500 eventos ficam armazenados localmente.

Se **Iniciar coleta** estiver apagado, a coleta anterior ainda está ativa ou pausada. Use **Continuar** para retomá-la na mesma conversa, ou **Encerrar e exportar** para preservar o material e liberar uma nova coleta. Prévia de link não é tratada como foto; controles de mídia que não possam ser identificados com segurança serão registrados como indisponíveis.

### Links e referência das mídias

A coluna **links** reúne os endereços presentes no texto, na legenda e nos destinos das ligações da mensagem (inclusive prévias), sem visitar os sites. Vários endereços são separados por ` | `. Endereços abreviados são preservados; a ferramenta não resolve redirecionamentos.

Com **Incluir mídias** marcado, cada arquivo recuperado recebe um identificador como **MID-000001**. A coluna **midias_ids** contém os identificadores e a coluna **midias** contém os caminhos dos arquivos correspondentes, na mesma ordem: por exemplo, `midias/MID-000001.png`. O `indice_midias.json` e o relatório associam **midia_id**, **mensagem_id**, caminho e hash. Os identificadores são exclusivos dentro de cada coleta e seguem a ordem de recuperação, não a cronologia das mensagens. Guarde o ZIP junto do CSV para preservar essa associação.

Apenas mídias enviadas na conversa são capturadas; imagens de prévias de sites não são substitutas dos arquivos originais. O download exige que a mídia esteja acessível na sessão. Controles não reconhecidos, arquivos expirados e downloads que falhem são registrados no relatório e no diagnóstico. Para aproveitar a identificação de vídeos e os links de destino adicionados na versão 0.1.3, faça uma nova coleta; esses dados não podem ser reconstruídos integralmente de CSVs antigos.

### Interações por mensagem

**interacoes_total** guarda a soma das reações exibida pelo WhatsApp, sem listar emojis ou participantes. **interacoes_precisao** indica `exata` quando o número completo está disponível, `aproximada` quando só há uma abreviação (ex.: “3,4 mil” vira 3400), ou `indisponivel` quando não foi possível ler a contagem. Nesse último caso o total fica vazio: ausência de dado não significa zero. **interacoes_observadas_em** registra quando a contagem foi lida. Ela pode mudar depois. Visualizações e compartilhamentos não são somados às reações.
