# Configurar o Google Drive

O login precisa de um **Client ID OAuth** criado pelo mantenedor. Não há servidor do Whatsapp Scoop e não é necessário fornecer sua senha à extensão. O Client ID é público; o segredo do cliente não é usado.

## Resumo

Crie um projeto Google, habilite a Drive API, cadastre seu e-mail como usuário de teste e crie um cliente OAuth **Aplicativo da Web**. Copie o redirecionamento mostrado na extensão para esse cliente. Cole o Client ID na extensão, conecte sua conta e teste com um canal sob seu controle.

## Passo a passo

1. Entre no [Google Cloud Console](https://console.cloud.google.com/) com a conta que administrará o aplicativo. No seletor de projetos, escolha **Novo projeto**, dê o nome **Whatsapp Scoop** e selecione o projeto criado.
2. Abra **APIs e serviços → Biblioteca**, procure **Google Drive API** e clique em **Ativar**. [Abrir a biblioteca da Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com).
3. Abra **Google Auth Platform** (ou **APIs e serviços → Tela de permissão OAuth**, conforme a interface). Configure o nome **Whatsapp Scoop**, seu e-mail de suporte e contato. Escolha público **Externo**, mantenha em **Teste** e adicione seu próprio e-mail em **Usuários de teste**. Contas de uma organização podem ter restrições do administrador.
4. Em **Acesso a dados / Escopos**, solicite somente `https://www.googleapis.com/auth/drive.file`. Isso permite trabalhar com os arquivos criados pelo aplicativo, sem pedir acesso ao Drive inteiro.
5. Na extensão, abra **Configuração do Google Drive** e copie o **Redirecionamento a cadastrar no Google**. Ele é gerado pelo Firefox para o ID fixo da extensão; não substitua por localhost ou por um endereço inventado. O botão de copiar evita erros.
6. No Google, abra **Clientes → Criar cliente** (ou **Credenciais → Criar credenciais → ID do cliente OAuth**). Escolha **Aplicativo da Web** e o nome **Whatsapp Scoop Firefox**. Em **URIs de redirecionamento autorizados**, cole exatamente o endereço do passo 5, incluindo a barra final se houver. Não é preciso cadastrar uma origem JavaScript para esse fluxo.
7. Copie o **ID do cliente**, terminado em `.apps.googleusercontent.com`. Cole em **Client ID público** na extensão e clique em **Salvar configuração**. **Não copie o segredo do cliente.**
8. Escolha destino **Google Drive**, clique em **Conectar ao Google Drive**, aceite as permissões do Firefox e selecione sua conta Google de teste. Se o Google bloquear o acesso por falta de configuração, confira os itens de solução de problemas abaixo.
9. Faça um teste curto: inicie o monitoramento de um canal, publique uma mensagem e uma mídia em seu canal de teste e clique em **Sincronizar agora**. Abra a pasta pelo painel e confirme os arquivos. Só depois deixe uma coleta longa rodando.

Você pode fazer os passos 1–4 enquanto prepara o restante. O redirecionamento também aparece nas versões anteriores da extensão, na configuração do mantenedor, pois o ID do aplicativo permanece o mesmo.

## Como o monitoramento salva

Uma pasta por monitoramento contém `mensagens.csv`, `midias/` e `.system/` para índice e relatório. A extensão envia mídias progressivamente e atualiza o **mesmo CSV**, em vez de criar um CSV a cada verificação. A atualização substitui o conteúdo do CSV; coletas grandes podem exigir mais tempo e tráfego de rede. A sincronização periódica não gera XLSX; esse formato mais demorado continua opcional na exportação manual/final.

As mensagens ficam no IndexedDB do Firefox. As mídias passam por armazenamento local antes do envio. Se você ativar a liberação das cópias locais, o arquivo só é liberado após o Drive confirmar o upload; o índice mantém o ID remoto, caminho, tamanho e hash. Nesse caso, o ZIP local terá referências às mídias remotas em vez das cópias liberadas. Para conservar também um ZIP completo, mantenha as cópias locais e acompanhe o espaço usado.

Uma fila limitada preserva os envios pendentes durante falhas de internet ou autorização. Se atingir o limite configurado, a captura pausa para evitar descarte. Você pode usar outras abas e fechar o painel da extensão, mantendo a aba do WhatsApp carregada no canal escolhido. Não há promessa de monitoramento quando o computador dorme, o navegador fecha, a aba é descartada ou o canal é trocado. Interrupções e possíveis lacunas precisam constar na metodologia.

## Login e limitações

O fluxo direto usa `identity.launchWebAuthFlow` e um token temporário, sem segredo embutido. É o fluxo implícito descrito no exemplo da Mozilla, legado e desaconselhado pelo Google para aplicações novas. A biblioteca remota Google Identity Services não é carregada na extensão. A aceitação do cliente e do redirecionamento precisa ser confirmada com suas credenciais reais.

A extensão tenta renovar a autorização silenciosamente quando permitido; isso não substitui um refresh token e pode falhar. Nesse caso, mostra **Reconectar**, preserva a fila e continua localmente até o limite de armazenamento. Tokens ficam somente na memória; reiniciar exige novo login. Desconectar interrompe novos envios, sem apagar arquivos existentes no Drive. Revogue o acesso também nas configurações da conta Google, se quiser encerrar a autorização no provedor.

Durante um monitoramento, a pasta permanece associada à conta originalmente conectada. Reconectar outra conta exige iniciar outra coleta; isso evita misturar destinatários.

## Se o Google apresentar um erro

| Mensagem ou situação | Conferir |
| --- | --- |
| `redirect_uri_mismatch` | Copie novamente o redirecionamento exato mostrado na extensão. Confira projeto e cliente escolhidos; mudanças no ID da extensão alteram o endereço. |
| `access_denied` ou aplicativo em teste | Seu e-mail precisa estar nos usuários de teste. Confira também restrições da organização. |
| Aplicativo ou cliente inválido | O tipo deve ser Aplicativo da Web, com Client ID correto e Drive API ativada. |
| Reconectar | O token expirou ou a renovação silenciosa não foi permitida. Conecte a mesma conta e use Sincronizar agora. |
| Erro 403 | Confira escopo `drive.file`, consentimento, quota de espaço e políticas da conta. |
| Erro 404 ao retomar | A pasta/arquivo pode ter sido removido ou pertencer a outra conta. Preserve o material local e confira o relatório. |
| Fila cheia | Reconecte/restabeleça internet e sincronize. Se estiver mantendo cópias locais, encerre e exporte; escolha um limite maior na próxima coleta somente se houver espaço disponível. |

Não apresente a integração como validada em uma conta real até confirmar login, criação da pasta, upload de mídia, atualização do CSV e retomada após expiração. Para distribuir a todos, o mantenedor pode incluir o Client ID público em `extension/config.json` e reconstruir o pacote. Publicação do aplicativo Google e da extensão Firefox são processos distintos.

## Referências técnicas

- [Mozilla: login direto e renovação sem interface](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/identity/launchWebAuthFlow).
- [Google: fluxo OAuth do cliente e limitações](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow).
- [Escopo drive.file](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).
- [Uploads retomáveis e atualização de arquivos](https://developers.google.com/workspace/drive/api/guides/manage-uploads).
