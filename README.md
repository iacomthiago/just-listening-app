# Just Listening

**Abrir o app:** <https://iacomthiago.github.io/just-listening-app/>

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
- Funciona offline: as músicas ficam guardadas no aparelho
- Sincronização opcional com o Dropbox: coloque músicas na pasta do app pelo computador e elas aparecem sozinhas no celular e no tablet (subpastas viram playlists)

## Sincronizar com o Dropbox

1. No app, toque em **ⓘ → Conectar Dropbox** e autorize. No app instalado na Tela de Início, o Dropbox mostra um código: copie e cole no app.
2. Coloque músicas (de preferência MP3) em **Dropbox › Aplicativos › Just Listening Thiago**. Subpastas viram playlists com o mesmo nome.
3. O app sincroniza ao abrir, ao voltar para ele e no botão de nuvem no topo. Músicas importadas direto no aparelho também são enviadas para o Dropbox (dá para desligar no ⓘ).

Excluir uma música no app não apaga a cópia no Dropbox, e ela não é baixada de novo.

> Para usar o código em outro projeto: crie seu próprio app em <https://www.dropbox.com/developers/apps> (Scoped access → App folder, permissões `files.content.read`/`files.content.write`, PKCE permitido, Redirect URI com o endereço do seu site) e troque `APP_KEY` em `dropbox.js`.

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

1. Crie um repositório novo em <https://github.com/new> (por exemplo, `just-listening-app`), marcado como **Public** e com **Add README** ligado (repositórios vazios às vezes falham no primeiro upload).
2. Na página do repositório, clique em **Add file → Upload files**.
3. Arraste **todo o conteúdo** desta pasta (incluindo a pasta `icons`) e clique em **Commit changes**.
4. Vá em **Settings → Pages**, em *Branch* escolha o branch principal do repositório (`main`, ou o nome que sua conta usa) e a pasta `/ (root)`, e clique em **Save**.
5. Em um ou dois minutos o app estará em `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.

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

- Sincronizar também as playlists criadas no app entre os aparelhos
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
| `dropbox.js` | Login e acesso à pasta do app no Dropbox |
| `sw.js` | Funcionamento offline |
| `manifest.webmanifest` | Nome, ícone e cores do app instalado |
