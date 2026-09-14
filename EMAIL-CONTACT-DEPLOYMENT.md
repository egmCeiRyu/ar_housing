# Botão de contato na tela AR

1. Aplicar `supabase/migrations/202609140002_automatic_client_contact.sql` no Supabase antes de publicar os arquivos de frontend. A migração anterior de contato manual não é necessária para esta versão; se já aplicada, a coluna permanece sem uso.
2. Publicar `ar.html`, `css/ar.css`, `js/ar.js`, `edit-project.html` e `js/edit-project.js` no site existente.
3. O endereço vem automaticamente do cadastro do cliente vinculado ao projeto, tanto para clientes existentes quanto para novos. Alterações no cadastro passam a valer ao abrir/recarregar a tela AR.
4. Abrir o link AR no celular e tocar em “お問い合わせ”, no canto superior esquerdo. Conferir destinatário, assunto e link no aplicativo de e-mail.

O visitante revisa e envia a mensagem pelo próprio aplicativo de e-mail. O dispositivo precisa ter um aplicativo de e-mail configurado. O botão fica oculto quando o endereço está ausente, é inválido ou a consulta falha. O e-mail do cadastro do cliente é usado como contato público, conforme solicitado. A função retorna somente o e-mail associado ao slug de um projeto ativo e mantém as políticas de leitura da tabela de clientes. Projetos inativos, inexistentes ou sem cliente correspondente retornam null.

Validação local: sintaxe de ambos os arquivos JavaScript; consulta RPC simulada com e-mail de cliente novo e atualizado, assunto japonês, rejeição de endereço ausente/inválido ou injeção de cabeçalhos e falha da consulta. A migração SQL foi revisada, mas não executada em banco local ou remoto. Publicação e abertura do aplicativo de e-mail em um celular real não foram executadas.
