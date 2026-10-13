# Dados e permissões

Whatsapp Scoop foi produzido por [douglasferreira](https://douglasferreira.me). A extensão coleta a conversa aberta após uma ação explícita do usuário. Não envia mensagens, não entra em grupos, não coleta a lista de contatos e não acessa bancos internos privados do WhatsApp.

Mensagens e arquivos ficam no IndexedDB do perfil Firefox. Não há telemetria. ZIP é local. Se o usuário escolher Google Drive, o corpus é enviado diretamente às APIs Google para uma pasta criada pela extensão. Não existe servidor do Whatsapp Scoop intermediando o conteúdo.

Nomes e números são preservados quando expostos na interface. Pseudonimização opcional afeta os campos de remetente/número, sem anonimizar texto, citações e mídias. Revise o corpus antes de compartilhar.

| Permissão | Motivo |
| --- | --- |
| `https://web.whatsapp.com/*` | Ler a conversa e operar a rolagem e os controles de mídia na aba do WhatsApp Web. |
| `storage` | Guardar configuração pública e preferências do aplicativo. |
| `unlimitedStorage` | Permitir corpus e mídias maiores no armazenamento da extensão; não garante espaço infinito. |
| `downloads` | Salvar o ZIP e liberar seu endereço temporário quando o download terminar ou falhar. |
| `scripting` | Executar a biblioteca WA-JS localmente no contexto da página WhatsApp autorizada, para baixar mídias pela sessão já conectada. Nenhum servidor intermediário. |
| `identity` | Abrir o login Google e receber o redirecionamento autorizado. O Firefox exige essa permissão no manifesto principal, mas a extensão só inicia login após clicar em Conectar. |
| Google APIs — opcionais | Validar a autorização e criar/enviar arquivos no Drive, quando o usuário escolhe esse destino. |

O token Google não é escrito no armazenamento ou nos logs. A validação usa o serviço `tokeninfo` do próprio Google. Desconectar limpa o token em memória, mas não revoga o acesso na conta Google nem apaga seus arquivos.

O manifesto declara nenhum envio obrigatório (`required: ["none"]`) e categorias opcionais para o Drive: comunicações pessoais, informações de identificação, conteúdo de sites e autenticação. No Firefox 140+, o botão Conectar solicita esses consentimentos junto com acesso aos domínios Google. A extensão verifica o consentimento antes de enviar e interrompe novos envios quando ele é removido. Referência: [sistema de consentimento Mozilla](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/).

**Apagar dados da coleta atual** remove seus registros locais após confirmação, sem apagar ZIPs ou arquivos no Drive. Coletas antigas podem permanecer no perfil até a remoção da extensão; não use o perfil do navegador como arquivo permanente. Instalações temporárias têm limitações de recuperação após reiniciar/desinstalar.

O código de captura de mídias observa brevemente a criação de um Blob e o clique de download do visualizador Firefox. Ele é restaurado ao encerrar a tentativa. O corpo das mensagens e tokens não são expostos ao contexto da página por esse código.

O diagnóstico guarda localmente até 500 eventos técnicos com contagens e erros sanitizados. O download é voluntário e não há telemetria ou compartilhamento automático.

WA-JS 4.6.1 é incluído no pacote (Apache-2.0). O contexto MAIN é compartilhado com o próprio WhatsApp; nele circulam apenas a identificação da conversa/mensagem necessária e bytes de mídias daquela sessão, nunca tokens Google. A extensão não chama funções de envio de mensagens, inscrição em canais ou alteração de contatos. A API valida a conversa ativa antes de cada obtenção de mídia.
