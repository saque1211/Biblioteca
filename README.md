# 📚 Minha Biblioteca

Aplicativo web de biblioteca pessoal de livros: catalogue tudo que você possui,
encontre rápido, registre como cada livro chegou até você e monte sua agenda de leitura.

## Stack

- **React 18 + TypeScript + Vite**
- **Tailwind CSS 4** — visual clean, modo claro/escuro
- **Dexie.js (IndexedDB)** — os dados ficam salvos no navegador, funcionam offline e persistem entre sessões, sem backend
- **Google Books API + Open Library API** — busca por título, autor ou ISBN com preenchimento automático (capa, gênero, editora, sinopse…). A Google Books é consultada primeiro; se falhar ou não retornar nada, a busca cai automaticamente na [Open Library](https://openlibrary.org/developers/api). Ambas são gratuitas e sem chave de API

## Rodando

```bash
npm install
npm run dev      # desenvolvimento
npm run build    # build de produção (dist/)
npm run preview  # serve o build
```

## Funcionalidades

- **Busca com autocomplete**: digite na barra central e escolha um resultado da Google Books — o livro entra com título, autor(es), capa, gênero, ISBN, editora, ano, nº de páginas e sinopse preenchidos. Também dá para adicionar manualmente.
- **Cards**: capa à esquerda, título, gênero como badge, status de leitura e estrelas.
- **Painel de detalhes**: origem/procedência, categoria de aquisição, data e valor de compra, local de compra, status de leitura, avaliação (0–5 estrelas), datas de início/término da leitura, estado de conservação, localização física, formato, idioma, empréstimo, favorito, tags livres e notas/resenha.
- **Categoria em lote**: ative uma categoria (ex.: "Doação Sicredi") e todos os próximos livros adicionados já entram com ela — um chip fixo no topo mostra qual está ativa.
- **Filtros**: gênero, status, categoria de aquisição, origem, avaliação, favoritos, autor, faixa de valor e formato. Ordenação por título, autor, data de aquisição, avaliação ou valor.
- **Agenda de leitura**: calendário mensal — clique num dia, escolha um livro, veja a capa em miniatura no dia e marque como concluído.
- **Resumo no topo**: total de livros, lidos e valor investido.
- **Backup**: exporte/importe a biblioteca inteira em JSON.

## Estrutura

```
src/
├── api/
│   ├── books.ts          # orquestrador: Google Books com fallback p/ Open Library
│   ├── googleBooks.ts    # cliente da Google Books API
│   └── openLibrary.ts    # cliente da Open Library API (busca + sinopse do work)
├── db/db.ts              # schema Dexie + operações (CRUD, backup)
├── hooks/                # tema claro/escuro, categoria em lote
├── components/
│   ├── ui/               # primitivos: Badge, Cover, Field, Modal, StarRating
│   ├── SearchBar.tsx     # autocomplete de adição
│   ├── BookCard.tsx      # card da lista
│   ├── BookDetailPanel.tsx  # painel lateral de edição
│   ├── FilterBar.tsx     # filtros e ordenação
│   ├── CalendarView.tsx  # agenda de leitura
│   └── …
├── types.ts              # modelo de dados
└── App.tsx
```
