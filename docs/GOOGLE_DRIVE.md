# Login direto no Google Drive — mantenedor

> **Em implementação e validação.** Use ZIP local enquanto a configuração e os testes com credenciais reais não estiverem concluídos.

O pesquisador só deve ver **Conectar ao Google Drive**, escolher a conta e autorizar. Esta configuração pertence ao mantenedor da distribuição, não a cada usuário.

## Decisão arquitetural

Não há servidor de autenticação. O Firefox abre o Google usando `identity.launchWebAuthFlow`, com `response_type=token`, `state` aleatório e escopo `drive.file`. A extensão valida o token recebido, sua audiência e o escopo antes de usá-lo. O token fica somente na memória do background e expira com a sessão. Não há refresh token ou client secret.

Este é o fluxo implícito documentado no exemplo da Mozilla, mantido pelo Google por compatibilidade e desaconselhado atualmente para aplicações novas. Não o descreva como o fluxo moderno recomendado. Se o Google não aceitar o aplicativo/redirecionamento, mantenha ZIP e reavalie um fluxo com código de autorização; não coloque um segredo dentro da extensão.

- [Firefox: launchWebAuthFlow](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/identity/launchWebAuthFlow)
- [Google: fluxo cliente e suas limitações](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow)
- [Escopo drive.file](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Uploads retomáveis](https://developers.google.com/workspace/drive/api/guides/manage-uploads)

## Configuração única

1. Crie um projeto no Google Cloud sob sua responsabilidade e habilite a Google Drive API.
2. Configure a tela de consentimento do aplicativo: nome **Whatsapp Scoop**, contato, links de suporte e política de privacidade. Em modo de teste, cadastre as contas de teste; a disponibilidade pública depende da publicação e das exigências aplicáveis do Google.
3. Crie um cliente OAuth do tipo **Aplicativo da Web** para o fluxo direto escolhido. Solicite somente `https://www.googleapis.com/auth/drive.file`.
4. Instale o pacote temporário. O ID do add-on é fixo: `whatsapp-scoop@douglasferreira.me`.
5. Abra **Configuração do mantenedor · Google** no painel e copie o redirecionamento mostrado. Cadastre **exatamente** esse endereço como URI de redirecionamento autorizado no cliente Google. Não substitua por localhost ou por um domínio fictício.
6. Informe o Client ID público na configuração do painel e salve. Para distribuí-lo a todos os usuários, preencha `googleClientId` em `extension/config.json` e reconstrua os pacotes.
7. Faça o teste completo com a conta permitida: login, criação da pasta, upload de mídia, CSV, índice e relatório. Confira audiência, escopo, expiração, login negado e redirecionamento incorreto.
8. Só depois divulgue o Drive como disponível. Sem um Client ID, o painel informa que o mantenedor ainda não configurou o login.

**Nunca** inclua um client secret, senha, token ou uma conta de serviço no Git, no pacote ou no README. Client ID identifica o aplicativo e é público. Um fork deve usar ID de extensão e cliente Google próprios; alterações no ID mudam o redirecionamento.

## Comportamento de upload

Cada coleta cria uma pasta `Whatsapp Scoop - [conversa] - [data]`, com `midias/` quando necessário e `.system/` para índice e relatório. CSV e XLSX ficam na raiz da coleta. O aplicativo acessa os arquivos que cria; não precisa de autorização para ler o Drive inteiro. As mídias são salvas localmente antes do upload.

O cliente usa sessões de upload retomável persistidas com o registro do arquivo. Uma falha de autorização pausa a coleta/envio. Reconectar permite consultar a posição já confirmada pelo Google e continuar. Falhas repetidas ficam visíveis; o arquivo continua disponível para ZIP. Se uma sessão de upload expirar no Google, o usuário deve exportar o ZIP preservado; não há promessa de retomada indefinida.

Desconectar remove o token da memória. Os arquivos já enviados permanecem no Drive e os dados locais permanecem no IndexedDB até a remoção solicitada pelo usuário.
