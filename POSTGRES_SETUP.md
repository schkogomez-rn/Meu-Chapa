# 🚀 Meu Chapa — Setup Local (PostgreSQL)

## Pré-requisitos

| Ferramenta | Versão mínima | Instalação |
|---|---|---|
| **Node.js** | 20+ | https://nodejs.org |
| **pnpm** | 10+ | `npm i -g pnpm` |
| **PostgreSQL** | 14+ | https://www.postgresql.org/download/ |

---

## Passo 1 — Instalar o PostgreSQL

1. Baixe e instale o PostgreSQL em https://www.postgresql.org/download/windows/
2. Durante a instalação, **anote a senha** do usuário `postgres`
3. Mantenha a porta padrão **5432**

Verifique se está rodando:

```powershell
psql -U postgres -c "SELECT version();"
```

> **`psql: command not found`?** Adicione o PostgreSQL ao PATH do Windows:
> ```powershell
> # PowerShell (ajuste a versão se necessário — aqui é 18)
> $env:PATH += ";C:\Program Files\PostgreSQL\18\bin"
> # Para tornar permanente, adicione via Painel de Controle → Variáveis de Ambiente
> ```
> Ou use o caminho completo diretamente: `& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres`

---

## Passo 2 — Criar o banco de dados

```powershell
psql -U postgres
```

Dentro do psql:

```sql
CREATE DATABASE meu_chapa;
\q
```

---

## Passo 3 — Configurar o `.env`

Edite o arquivo `.env` na raiz do projeto e ajuste os campos marcados:

```env
NODE_ENV=development

# ✏️ Ajuste usuário e senha conforme sua instalação do PostgreSQL
DATABASE_URL=postgresql://postgres:SUA_SENHA@127.0.0.1:5432/meu_chapa

# ✏️ Chave secreta para os cookies JWT (qualquer string longa serve em dev)
JWT_SECRET=uma-chave-local-longa-e-segura

# ✏️ Obtenha em: https://manus.im (painel do seu app)
VITE_APP_ID=seu_app_id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://auth.manus.im
OWNER_OPEN_ID=seu_open_id

# Deixe em branco para desenvolvimento local
BUILT_IN_FORGE_API_URL=
BUILT_IN_FORGE_API_KEY=
```

---

## Passo 4 — Instalar as dependências

```powershell
pnpm install
```

---

## Passo 5 — Criar as tabelas no banco

```powershell
pnpm db:push
```

> **Atenção:** Use sempre `pnpm db:push`, nunca `drizzle-kit` diretamente.
> O `drizzle-kit` é uma dependência **local** do projeto e não fica disponível no PATH do terminal.
> O pnpm resolve automaticamente o binário em `node_modules/.bin/`.

Esse comando cria automaticamente no banco:

- Tipo ENUM `role` → `user | admin`
- Tipo ENUM `order_status` → `received | preparing | ready | completed | cancelled`
- Tabela `users`
- Tabela `orders`

Verifique o resultado:

```powershell
psql -U postgres -d meu_chapa -c "\dt"
```

---

## Passo 6 — Rodar o projeto

```powershell
pnpm dev
```

> **`NODE_ENV não é reconhecido`?** Isso acontece em terminais Windows (CMD/PowerShell).
> O projeto já usa `cross-env` nos scripts para resolver isso automaticamente.
> Se o erro persistir, certifique-se de rodar `pnpm install` antes.

O servidor encontra automaticamente uma porta disponível a partir da **3000**.  
Acesse pelo endereço exibido no terminal:

```
Server running on http://localhost:3000/
```

---

## Comandos disponíveis

| Comando | O que faz |
|---|---|
| `pnpm dev` | Inicia o servidor em modo desenvolvimento (hot reload) |
| `pnpm build` | Gera o bundle de produção (`dist/`) |
| `pnpm start` | Roda o bundle de produção |
| `pnpm db:push` | Gera migrations e aplica no banco |
| `pnpm check` | Verifica tipos TypeScript |
| `pnpm test` | Executa os testes com Vitest |
| `pnpm format` | Formata o código com Prettier |

---

## Resetar o banco (do zero)

Se precisar recriar todas as tabelas:

```powershell
psql -U postgres -d meu_chapa
```

```sql
DROP TABLE IF EXISTS orders, users CASCADE;
DROP TYPE IF EXISTS role, order_status CASCADE;
\q
```

Depois rode novamente:

```powershell
pnpm db:push
```

---

## Troubleshooting

### `ECONNREFUSED 127.0.0.1:5432`
O serviço PostgreSQL não está rodando:
```powershell
Start-Service -Name postgresql*
```

### `password authentication failed for user "postgres"`
A senha no `DATABASE_URL` está incorreta. Confirme com:
```powershell
psql -U postgres -h 127.0.0.1
```

### `database "meu_chapa" does not exist`
Volte ao **Passo 2** e crie o banco.

### `type "role" already exists`
A migration já foi aplicada anteriormente. Reset o banco conforme a seção acima ou rode apenas `drizzle-kit migrate` (sem `generate`).

### Porta 3000 ocupada
O servidor detecta automaticamente a próxima porta livre. Verifique qual foi usada na saída do terminal.
