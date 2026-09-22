# Rally FJU — plataforma reutilizável

Aplicação React + Vite preparada para **Supabase** como backend principal: Postgres, Auth, RLS e Realtime.

## O que já está estruturado

- configuração de título, subtítulo, cores e duração do Rally;
- seleção das 12 tribos de Israel por edição;
- ranking público e histórico semanal;
- missões editáveis com cálculo automático;
- painel administrativo e modo líder de tribo;
- lançamento semanal com janela de domingo, 16h–19h;
- fechamento automático às 19h, zero para quem não enviou e bloqueio até segunda, 7h;
- cadastro e frequência de obreiros e jovens;
- dashboard de presença, retorno e destaques;
- relatórios gerais, por igreja e individual com compartilhamento por WhatsApp;
- comunicados públicos;
- zona de perigo para reiniciar e finalizar o Rally;
- criação de nova edição com arquivamento da edição anterior.

## Supabase

O projeto usa o Supabase configurado por `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. A chave publicável pode existir no frontend; **service_role nunca deve ser usada no navegador**. O acesso aos dados é protegido por RLS.

A estrutura completa está em `supabase/migrations/20260922000100_rally_supabase.sql`, incluindo tabelas, Auth profiles, RLS, Realtime e os três agendamentos do Rally via pg_cron.

A migração de schema deve ser aplicada ao projeto Supabase com o fluxo oficial de migrations.

### Primeiro administrador

Crie o usuário no Supabase Authentication. O e-mail `admin@rallyfju.com` recebe automaticamente o perfil `admin` pelo trigger da migração. Para outro e-mail, o perfil deve ser promovido para `admin` no banco.

### Agendamento

A migração usa pg_cron para:

- domingo 16h (19h UTC): abrir lançamentos;
- domingo 19h (22h UTC): fechar, lançar zero nas tribos sem envio e bloquear;
- segunda 7h (10h UTC): liberar novamente.

## Desenvolvimento

```bash
npm install
npm run dev
npm run build
```
