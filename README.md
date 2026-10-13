> **Versão beta (de teste).** Estou providenciando uma versão assinada para publicar na loja de extensões do Firefox. Por enquanto, a instalação é temporária: siga o guia abaixo. **A exportação direta para o Google Drive está em implementação.**

<p align="center">
  <img src="docs/branding/logo.png" width="128" alt="Whatsapp Scoop: balão de conversa sorridente com óculos de pesquisador">
</p>

# Whatsapp Scoop

Uma ferramenta para **facilitar o trabalho de pesquisadores de comunicação social na internet**. Ela reúne mensagens de um grupo ou canal do WhatsApp em uma planilha e, se você quiser, também baixa as mídias. Assim, você pode organizar um corpus, analisar conteúdos e documentar sua coleta para artigos e outras pesquisas, inclusive sobre desinformação.

Produzido por **[douglasferreira](https://douglasferreira.me)**. A ferramenta organiza o material; a análise e a classificação dos conteúdos cabem ao pesquisador.

## Resumo da explicação

Este é o **resumo**; o passo a passo completo está logo abaixo. Você não precisa saber programar.

1. Baixe e descompacte o [pacote de teste](https://github.com/douglasferreira-me/WAScoop/releases/download/v0.3.0-beta/whatsapp-scoop-0.3.0-temporario.zip).
2. No Firefox, abra `about:debugging` → **Este Firefox** → **Carregar extensão temporária** e selecione `manifest.json` na pasta descompactada.
3. Abra o grupo ou canal no WhatsApp Web, abra o painel **Whatsapp Scoop** e clique em **Iniciar coleta**. Marque **Incluir mídias** se quiser os arquivos.
4. Ao terminar, salve e descompacte o ZIP. Abra `mensagens.csv` como uma planilha e conserve os demais arquivos junto dela. Se marcar a opção XLSX, também terá uma planilha pronta para análise.

**Ao fechar e reabrir o Firefox, será necessário carregar a extensão novamente. Exporte sua coleta antes de fechar o navegador.**

## Passo a passo: instalar a versão de teste

Use **Firefox para computador, versão 140 ou posterior**. Não é necessário instalar Python ou outros programas de desenvolvimento.

1. **Baixe o pacote.** Clique em [whatsapp-scoop-0.3.0-temporario.zip](https://github.com/douglasferreira-me/WAScoop/releases/download/v0.3.0-beta/whatsapp-scoop-0.3.0-temporario.zip). Normalmente ele será salvo na pasta **Downloads**. Use esse arquivo, e não o pacote de código-fonte ou o arquivo `.xpi`.
2. **Descompacte o arquivo.** ZIP é um arquivo que reúne uma pasta e seus conteúdos. No Windows, clique com o botão direito e escolha **Extrair tudo**. No macOS, dê dois cliques no ZIP. Guarde a pasta extraída: você precisará dela nas próximas instalações.
3. **Abra a página de instalação.** No Firefox, clique na barra de endereço, no alto da janela. Digite `about:debugging` e pressione **Enter**.
4. **Escolha este navegador.** Clique em **Este Firefox**, à esquerda. Depois clique em **Carregar extensão temporária…**. Se o Firefox estiver em inglês, os nomes são **This Firefox** e **Load Temporary Add-on…**.
5. **Selecione o arquivo da extensão.** Na janela que abrir, entre na pasta descompactada e escolha **manifest.json**. Clique em **Abrir**. Esse arquivo informa ao Firefox como carregar a extensão; você não precisa editá-lo.
6. **Confira a instalação.** O nome **Whatsapp Scoop** aparecerá na lista dessa página. A extensão está pronta para uso.

Essa instalação de teste desaparece quando o Firefox é reiniciado. Para reinstalar, repita os passos **3 a 5**, usando a mesma pasta. O arquivo `.xpi` não assinado ainda não permite instalação permanente no Firefox comum.

## Passo a passo: fazer uma coleta

1. **Abra o WhatsApp.** Acesse [WhatsApp Web](https://web.whatsapp.com) no Firefox e conecte sua conta seguindo as instruções da página. Se a aba já estava aberta durante a instalação, recarregue-a.
2. **Escolha a conversa.** Abra o grupo ou canal que deseja pesquisar. Cada coleta trabalha com **uma conversa por vez**, usando o histórico acessível à sua conta.
3. **Abra o painel.** Clique no ícone **Whatsapp Scoop** na barra do Firefox. Se não aparecer, procure-o no botão **Extensões**, com o símbolo de uma peça de quebra-cabeça. No painel, clique em **Atualizar** e confira o nome da conversa.
4. **Escolha o período.** Preencha as datas inicial e final se precisar de um recorte. Deixe ambas vazias para buscar todo o histórico acessível.
5. **Escolha as mídias.** Marque **Incluir mídias** para baixar fotos, vídeos, áudios, documentos e figurinhas disponíveis. Deixe desmarcado para coletar somente as mensagens e seus dados. Mídias aumentam o tempo e o espaço necessário.
6. **Escolha a planilha.** Marque **Incluir planilha de análise (XLSX)** se quiser resumo, filtros e melhor visualização. É opcional e vem desmarcada: **pode aumentar o tempo de exportação**, especialmente em coletas grandes. O CSV sempre será incluído.
7. **Escolha a identificação.** A opção **Usar pseudônimos para remetentes** substitui nomes e números nos campos de identificação. Ela não remove informações pessoais presentes nos textos ou nas imagens.
8. **Inicie.** Mantenha o destino **Baixar um ZIP no computador** e clique em **Iniciar coleta**. Deixe a aba aberta e evite navegar na conversa enquanto a ferramenta trabalha.
9. **Acompanhe.** O painel mostra a etapa atual, quantas mensagens foram coletadas, o período alcançado e os resultados das mídias. Como o tamanho total do histórico é desconhecido, não há uma porcentagem de conclusão.
10. **Salve o resultado.** Ao terminar, o Firefox oferecerá o download do ZIP. Escolha onde guardá-lo. Para terminar antes, clique em **Encerrar e exportar**: você receberá o material coletado até esse momento.

Use **Pausar** e **Continuar** para interromper e retomar. Se trocar de conversa, volte à original para continuar. Se fechar ou recarregar a aba, exporte o material parcial e inicie uma nova coleta. Para tentar novamente um download, use **Exportar ZIP**.

### Abrir e compreender os arquivos

Descompacte o ZIP da coleta como fez com o pacote de instalação. **Conserve a pasta inteira**, pois a planilha faz referência aos arquivos de mídia.

| Conteúdo | Como usar |
| --- | --- |
| `mensagens.xlsx` | Opcional: incluída quando você marca **Incluir planilha de análise (XLSX)**. Pronta para leitura e análise, com abas **Resumo**, **Mensagens** e **Mídias**, filtros, cabeçalhos fixos e linhas alternadas. |
| `mensagens.csv` | Os mesmos dados das mensagens em formato simples, para importar em programas de análise. |
| `midias/` | Mídias recuperadas, quando a opção foi marcada. |
| `.system/indice_midias.json` | Lista que associa cada arquivo à sua mensagem e registra formato, tamanho e hash para conferência. |
| `.system/relatorio_coleta.json` | Registro da versão, período, quantidades, falhas e interrupções. Guarde-o para documentar a metodologia. |

**Se escolheu XLSX, abra `mensagens.xlsx` no Excel ou LibreOffice.** Na aba **Mensagens**, use as setas dos cabeçalhos para filtrar por remetente, tipo, data ou interações. As datas estão em UTC e as contagens são numéricas. O resumo registra a coleta e não muda ao filtrar. Campos muito longos ficam completos, em partes numeradas, na aba **Textos longos**, quando necessária.

A pasta `.system` reúne os arquivos técnicos e pode ficar oculta no computador; as informações principais também estão na aba **Resumo**, se você escolheu XLSX. No Windows, ative **Exibir → Itens ocultos** no Explorador; no macOS, use **⌘ + Shift + .** no Finder.

Para outros programas, abra `mensagens.csv` no Excel ou LibreOffice, ou importe no Google Planilhas. Se o conteúdo aparecer em uma única coluna ou com caracteres estranhos, escolha **Importar texto/CSV**, codificação **UTF-8** e separador **vírgula**.

- **Mídias:** `midias_ids` identifica arquivos como `MID-000001`; `midias` informa o caminho, por exemplo `midias/MID-000001.png`. Vários arquivos aparecem na mesma ordem nas duas colunas, separados por ` | `.
- **Links:** a coluna `links` registra os endereços encontrados nas mensagens, sem abrir os sites. Imagens de prévias de links não substituem mídias enviadas diretamente.
- **Interações:** `interacoes_total` registra o total de reações observado. `interacoes_precisao` indica se a contagem é exata, aproximada ou indisponível. Um campo vazio não significa zero. A contagem pode mudar depois da coleta.

### Google Drive: em implementação

**A exportação direta para o Google Drive está sendo implementada e validada.** O envio também depende de uma configuração feita pelo mantenedor. **Enquanto o painel indicar que o login não está configurado, use o ZIP.** Quando disponível, escolha o destino Google Drive, clique em **Conectar ao Google Drive**, autorize sua conta e inicie a coleta. A extensão criará uma pasta e enviará os arquivos diretamente para ela. O pesquisador não precisa criar credenciais. [Configuração para mantenedores](docs/GOOGLE_DRIVE.md).

## Se algo não funcionar

| Problema | O que fazer |
| --- | --- |
| A conversa não aparece | Abra-a no WhatsApp Web, recarregue a página e clique em **Atualizar**. |
| **Iniciar coleta** está apagado | A coleta anterior ainda está ativa ou pausada. Use **Continuar** na conversa original ou **Encerrar e exportar** antes de começar outra. |
| Uma mídia falhou | Confira o relatório: o arquivo pode estar indisponível ou a integração precisar de ajuste. |
| O ZIP não baixou | Tente **Exportar ZIP** novamente. Para coletas muito grandes, faça recortes menores por data. |
| Preciso relatar um erro | Clique em **Baixar log de diagnóstico** e envie o arquivo ao pedir ajuda. Se o download também falhar, use **Ver ou copiar o log**. |

O log pode ser baixado **mesmo quando tudo funciona**. Ele registra etapas, contagens e erros, sem incluir textos das mensagens, nomes da conversa ou credenciais. Não é enviado automaticamente. Após reiniciar, você pode tentar **Recuperar última coleta** em **Dados temporários**, mas não conte com recuperação após remover a extensão.

## Cuidados para usar em pesquisa

A coleta alcança o que o WhatsApp disponibiliza à sua conta. **Chegar ao limite da rolagem não comprova que todo o histórico foi recuperado.** Arquivos expirados ou apagados não são reconstruídos; falhas ficam registradas. Mudanças no WhatsApp podem afetar a extensão.

Confira uma amostra das mensagens e mídias antes de analisar o corpus. Datas reconhecidas usam o padrão ISO em UTC; `data_original` preserva a informação observada. Campos desconhecidos ficam vazios; mensagens sem data reconhecida são excluídas quando há filtro de datas. Revise dados pessoais antes de compartilhar materiais ou publicar exemplos.

Na metodologia, registre a versão indicada no relatório, data da coleta, período solicitado e limitações observadas. Exemplo de referência: **douglasferreira. Whatsapp Scoop, versão [versão do relatório]. Disponível em https://github.com/douglasferreira-me/WAScoop. Coleta realizada em [data].** Consulte também [privacidade e permissões](docs/PRIVACIDADE.md) e [estado da validação](docs/VALIDACAO.md).

## Para desenvolver ou fazer um fork

A extensão usa JavaScript, HTML e CSS para funcionar no Firefox sem programa auxiliar; Python prepara os pacotes. A coleta combina rolagem e leitura da página com download de mídias pela sessão conectada, usando WA-JS. Essa integração é não oficial; não há Baileys nem servidor próprio.

O [guia técnico para forks](docs/DESENVOLVIMENTO.md) explica instalação do ambiente, organização do código, testes, empacotamento e distribuição. O projeto usa **GPL-3.0**, com licenças próprias para as bibliotecas incluídas.
