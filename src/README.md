# Painel Executivo de Estoque — MUDE

Dashboard de controle de estoque com sincronização ao vivo direto do Google Sheets, construído em React + Vite + Tailwind CSS.

## O que tem aqui

- Dois cards de destaque (Itens Críticos em Falta / Itens Não Críticos em Falta) com anel de progresso
- Gráficos (Recharts): saúde do estoque por praça e top produtos para compra
- Tabela com busca, paginação e filtro automático ao clicar nos cards
- Sincronização automática com a planilha do Google Sheets a cada 60 segundos
- Modo claro/escuro

## Como publicar (GitHub + Vercel, sem instalar nada no seu computador)

**1. Crie um repositório novo no GitHub**
   - Vá em github.com → botão **"+"** → **"New repository"**
   - Dê um nome (ex: `painel-estoque-executivo`) → **Create repository**

**2. Envie os arquivos**
   - Na tela do repositório vazio, clique em **"uploading an existing file"**
   - Arraste **todos os arquivos e pastas deste projeto** (incluindo a pasta `src`) para a área de upload
   - Escreva uma mensagem de commit → **Commit changes**

**3. Publique na Vercel**
   - Vá em [vercel.com](https://vercel.com) → entre com login do GitHub
   - **"Add New..." → "Project"**
   - Escolha o repositório que você acabou de criar
   - A Vercel detecta automaticamente que é um projeto Vite — não precisa mudar nada
   - Clique em **"Deploy"**

Em cerca de 1 minuto você recebe um link `seu-projeto.vercel.app` com o painel completo no ar, e ele fica se sincronizando sozinho com a planilha.

## Rodando localmente (opcional, exige Node.js instalado)

```bash
npm install
npm run dev
```

## Fonte de dados

Os dados vêm da planilha do Google Sheets (abas "Estoque" e "Movimentações"). Para que a sincronização funcione, a planilha precisa estar compartilhada como "qualquer pessoa com o link pode visualizar".
