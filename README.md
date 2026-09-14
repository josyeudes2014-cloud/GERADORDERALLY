# Rally FJU — plataforma reutilizável

Aplicação React + Vite preparada para Firebase (`rallyfjuniteroi`) e para reutilizar o mesmo site em várias edições do Rally.

## O que já está estruturado

- configuração de título, subtítulo, cores e duração do Rally;
- seleção das 12 tribos de Israel por edição;
- ranking público e histórico semanal;
- 10 semanas de missões editáveis;
- painel administrativo e modo líder de tribo;
- lançamento semanal com janela de domingo, 16h–19h;
- fechamento automático às 19h, zero para quem não enviou e bloqueio até segunda, 7h;
- cadastro e frequência de obreiros e jovens;
- dashboard de presença, retorno e destaques;
- relatórios gerais, por igreja e individual com compartilhamento por WhatsApp;
- comunicados públicos;
- zona de perigo para reiniciar e finalizar o Rally;
- criação de nova edição com arquivamento da edição anterior.

## Firebase

O projeto padrão em `.firebaserc` é `rallyfjuniteroi`. O Web SDK usa apenas identificadores públicos do Firebase. Credenciais administrativas não ficam no frontend.

Para produção, habilite **Authentication > Email/Password**, crie `admin@rallyfju.com` e faça deploy de Hosting, Firestore Rules, Storage Rules e Functions com Firebase CLI. As funções agendadas usam Cloud Scheduler e podem exigir faturamento habilitado no projeto Firebase.

## Desenvolvimento

```bash
npm install
npm run dev
npm run build
```
