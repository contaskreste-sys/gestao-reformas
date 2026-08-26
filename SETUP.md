# Setup local — SaaS de Gestão de Reformas

Passo a passo pra colar todos os arquivos que geramos num projeto Vite
funcionando de verdade na sua máquina.

## 1. Criar o projeto

```bash
npm create vite@latest gestao-reformas -- --template react
cd gestao-reformas
npm install
```

## 2. Instalar as dependências usadas nos componentes

```bash
npm install @supabase/supabase-js lucide-react
```

## 3. Instalar e configurar o Tailwind

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Edite `tailwind.config.js` pra apontar pros seus arquivos:

```js
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: { extend: {} },
  plugins: [],
};
```

No `src/index.css` (substitua o conteúdo padrão):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

## 4. Copiar os arquivos gerados

Coloque estes arquivos dentro de `src/`, mantendo os nomes:

- `supabase-obras.js`
- `auth-tela.jsx`
- `minhas-obras.jsx`
- `nova-obra.jsx`
- `dashboard-mestre-obras-supabase.jsx`
- `dashboard-cliente.jsx`

Substitua o `src/App.jsx` padrão do Vite pelo `App.jsx` que gerei — ele já
importa todas as telas acima e faz a navegação entre elas.

Em `src/main.jsx`, confirme que o `index.css` está sendo importado (o
template do Vite já faz isso por padrão):

```jsx
import "./index.css";
```

## 5. Configurar as variáveis de ambiente

Copie `.env.example` para `.env` na raiz do projeto e preencha com os dados
do seu projeto Supabase (**Settings → API**):

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

## 6. Rodar o schema no Supabase

No painel do Supabase → **SQL Editor**, cole o conteúdo de
`supabase-schema-completo.sql` inteiro e rode. Isso cria as 16 tabelas, as
funções auxiliares, os triggers (progresso automático + criação de usuário),
o Realtime e todas as políticas de RLS.

## 7. Configurar a URL de confirmação de e-mail

**Authentication → URL Configuration**:
- **Site URL**: `http://localhost:5173` (porta padrão do Vite)
- **Redirect URLs**: adicione `http://localhost:5173/**`

Isso evita o erro de link de confirmação quebrado que você teve antes.

## 8. Criar o bucket de Storage (se o SQL não tiver criado automaticamente)

O `supabase-schema-completo.sql` já inclui o `insert into storage.buckets`,
mas se por algum motivo não aparecer, crie manualmente em **Storage**:
- Nome: `fotos-obra`
- Público: **não** (privado)

## 9. Rodar o projeto

```bash
npm run dev
```

Abra `http://localhost:5173`. Você deve cair na tela de login/cadastro.

## Roteiro de teste sugerido

1. Cadastre-se como **empreiteiro** (confirme o e-mail se sua config do
   Supabase exigir)
2. Cadastre-se como **cliente** com outro e-mail (numa aba anônima, pra não
   perder a sessão do empreiteiro)
3. Logado como empreiteiro, clique em **"Cadastrar nova obra"** e use o
   e-mail do cliente que você acabou de criar
4. Você cai automaticamente no dashboard do mestre de obras — poste uma foto
   e mude o percentual de uma etapa
5. Abra a aba anônima com a sessão do cliente, entre na obra e veja o
   progresso e a foto aparecerem **sem precisar recarregar a página**
   (é o Realtime funcionando)
6. Como empreiteiro, mude o status da obra pra **"Concluída"**
7. Como cliente, veja o card de avaliação aparecer e envie uma nota

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| "Database error saving new user" no cadastro | Trigger `handle_new_user` não foi criada — rode o SQL de novo |
| Dashboard fica carregando pra sempre | `obraId` errado, ou RLS bloqueando (confira se o usuário está mesmo vinculado à obra em `equipe_obra`/`obras.cliente_id`) |
| Link de confirmação de e-mail quebrado | Site URL / Redirect URLs desatualizados (passo 7) |
| Foto não aparece pro cliente | Publicação `supabase_realtime` sem a tabela `fotos_progresso`, ou bucket com política de leitura errada |
