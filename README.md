# Just Listening

Player de músicas **locais** para iPhone e Android, feito como app web instalável (PWA).
Ideal para ouvir as músicas que você gera e baixa (por exemplo, do Suno) com repetição e timer para dormir, sem assinatura e sem internet.

## Recursos

- Importa arquivos MP3, M4A, WAV, AAC, FLAC… direto do aparelho (vários de uma vez)
- Lê nome, artista e capa das tags do MP3 automaticamente
- Várias playlists: criar, renomear, reordenar, excluir
- Repetir a playlist ou repetir uma música só
- Modo aleatório
- Timer para dormir (15 min a 2 h, tempo personalizado ou "quando esta música acabar") com volume diminuindo aos poucos no final
- Editar nome, artista e capa de cada música
- Controles na tela bloqueada e na central de controle
- Funciona offline: as músicas ficam guardadas só no aparelho, nada é enviado para a internet

## Como instalar

### iPhone (Safari)
1. Abra o link do app no **Safari**.
2. Toque em **Compartilhar** (quadrado com seta para cima).
3. Escolha **Adicionar à Tela de Início**.
4. Abra o app pelo ícone novo e importe suas músicas **por ele**.

> Importante: no iPhone, o app instalado na Tela de Início tem um armazenamento separado do Safari.
> Importe as músicas depois de instalar, abrindo pelo ícone.

### Android (Chrome)
1. Abra o link no **Chrome**.
2. Toque em **Instalar** no aviso que aparece no app, ou no menu **⋮ → Instalar app**.

## Publicar no GitHub Pages (grátis)

Não precisa instalar nada no computador:

1. Crie um repositório novo em <https://github.com/new> (por exemplo, `just-listening`), marcado como **Public**.
2. Na página do repositório, clique em **Add file → Upload files**.
3. Arraste **todo o conteúdo** desta pasta (incluindo a pasta `icons`) e clique em **Commit changes**.
4. Vá em **Settings → Pages**, em *Branch* escolha `main` e a pasta `/ (root)`, e clique em **Save**.
5. Em um ou dois minutos o app estará em `https://SEU-USUARIO.github.io/just-listening/`.

### Publicando uma versão nova
Ao alterar arquivos, aumente o número em `CACHE` no arquivo `sw.js` (por exemplo, `just-listening-v2`).
Assim os aparelhos baixam a versão nova (ela aparece na segunda vez que o app é aberto).

## Testar no computador

```bash
python -m http.server 5173
```

Depois abra <http://localhost:5173>.

## Limitações conhecidas

- **Fade-out no iPhone:** o iOS não permite que apps da web mudem o volume. No iPhone, o timer pausa a música no horário certo, mas sem diminuir o volume aos poucos. No Android funciona normalmente.
- **Espaço:** as músicas ocupam espaço do aparelho. O app pede ao sistema para não apagar os dados automaticamente; veja o espaço usado no botão ⓘ.
- **Formatos:** o que toca depende do aparelho. MP3, M4A/AAC e WAV tocam em todos.

## Próximos passos (ideias)

- Sincronizar com a nuvem (Google Drive, Dropbox ou OneDrive) para não precisar importar em cada aparelho
- Fila de reprodução editável
- Exportar/importar playlists

## Estrutura

| Arquivo | O que faz |
| --- | --- |
| `index.html` | Estrutura da página |
| `style.css` | Visual (tema escuro) |
| `app.js` | Player, playlists, timer, importação |
| `db.js` | Armazenamento local (IndexedDB) |
| `id3.js` | Leitura de nome/artista/capa dos MP3 |
| `sw.js` | Funcionamento offline |
| `manifest.webmanifest` | Nome, ícone e cores do app instalado |
