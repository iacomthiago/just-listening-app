# Just Listening

**Abrir o app:** <https://iacomthiago.github.io/just-listening-app/>

Player de músicas **locais** para iPhone e Android, feito como app web instalável (PWA).
Ideal para ouvir as músicas que você gera e baixa (por exemplo, do Suno) com repetição e timer para dormir, sem assinatura e sem internet.

**Versão atual: 1.4.0** · testado no iPhone (app instalado na Tela de Início) e no computador.

## Quer usar? Comece aqui

O app é **gratuito e aberto para qualquer pessoa**. Não precisa de cadastro.

1. **Abra o link** <https://iacomthiago.github.io/just-listening-app/> no **Safari** (iPhone) ou no **Chrome** (Android).
2. **Instale na tela inicial:** no iPhone, toque em Compartilhar → **Adicionar à Tela de Início**; no Android, toque em **Instalar** (ou menu ⋮ → Instalar app).
3. **Abra pelo ícone** e toque em **Importar** para escolher suas músicas (MP3, M4A, WAV…). Dá para selecionar várias de uma vez. Só tem o vídeo da música? Importe o **MP4 ou MOV** que o app guarda só o áudio.
4. **Opcional, Dropbox:** para ter as mesmas músicas no celular, no tablet e no computador, toque em **ⓘ → Conectar Dropbox** (veja abaixo).

**Sua privacidade:** suas músicas ficam **só no seu aparelho**. Se você conectar o Dropbox, o app usa **a sua própria conta**, numa pasta só dele (*Aplicativos › Just Listening Thiago*) — sem acesso ao resto dos seus arquivos. Ninguém mais, nem o autor do app, vê suas músicas.

## Recursos

- **Modo Dormir com um toque:** toca a playlist escolhida repetindo e liga o timer; pode esperar a música terminar antes de parar
- **Favoritas ♥:** marque músicas e ouça a playlist automática "Favoritas"
- **Letras:** veja a letra no player (lida do próprio MP3, se tiver) ou cole a letra do Suno
- **Capa da playlist:** escolha uma imagem para cada playlist
- Importa arquivos MP3, M4A, WAV, AAC, FLAC… direto do aparelho (vários de uma vez)
- **Áudio de vídeos:** importe um vídeo MP4/MOV e o app extrai só o áudio (.m4a), sem perder qualidade, em poucos segundos; a capa vem de um quadro do vídeo. Funciona também com vídeos colocados na pasta do Dropbox
- Lê nome, artista, capa e letra das tags do MP3 automaticamente
- Abre nas **Playlists**, com atalho para **Todas as músicas** e **Favoritas**
- Ordenar músicas por **Recentes, A–Z ou Z–A** e **buscar** por nome ou artista (sem se preocupar com acentos)
- Várias playlists: criar, renomear, reordenar, excluir
- Repetir a playlist ou repetir uma música só
- Modo aleatório
- **Toca a playlist inteira com a tela bloqueada**, inclusive voltando para a primeira música no "repetir playlist"
- Timer para dormir (15 min a 2 h, tempo personalizado ou "quando esta música acabar"), com opção de esperar a música terminar ou de diminuir o volume aos poucos
- Editar nome, artista e capa de cada música
- Controles na tela bloqueada e na central de controle
- Funciona offline: as músicas ficam guardadas no aparelho
- **Sincronização com o Dropbox:** coloque músicas na pasta do app pelo computador e elas aparecem sozinhas no celular e no tablet (subpastas viram playlists). Playlists, favoritas, letras e nomes editados também ficam iguais em todos os aparelhos
- Atualiza sozinho quando uma versão nova é publicada

## Sincronizar com o Dropbox

1. No app, toque em **ⓘ → Conectar Dropbox** e autorize. No app instalado na Tela de Início, o Dropbox mostra um código: copie e cole no app.
2. Coloque músicas (de preferência MP3) em **Dropbox › Aplicativos › Just Listening Thiago**. Subpastas viram playlists com o mesmo nome.
3. O app sincroniza ao abrir, ao voltar para ele e no botão de nuvem no topo. Músicas importadas direto no aparelho também são enviadas para o Dropbox (dá para desligar no ⓘ).

Excluir uma música no app não apaga a cópia no Dropbox, e ela não é baixada de novo.

Precisa de uma conta do Dropbox (o plano grátis tem 2 GB, cerca de 300 músicas em MP3). Cada pessoa usa a própria conta. A integração está liberada para até 500 contas.

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
Ao alterar arquivos, aumente o número em `CACHE` no arquivo `sw.js` (por exemplo, `just-listening-v5`) e o `VERSION` em `app.js`.
Os aparelhos baixam a versão nova sozinhos e recarregam quando nada estiver tocando.

## Testar no computador

```bash
python -m http.server 5173
```

Depois abra <http://localhost:5173>.

## Limitações conhecidas

- **Fade-out no iPhone:** o iOS não permite que apps da web mudem o volume. No iPhone, o timer pausa a música no horário certo, mas sem diminuir o volume aos poucos. No Android funciona normalmente.
- **Troca de faixa:** para não ficar sem som com a tela bloqueada no iPhone, a próxima música começa um instante antes do fim da atual. Isso pode cortar até ~1 segundo do final de cada música.
- **Dropbox:** excluir uma música no app não apaga o arquivo no Dropbox. Playlists, favoritas e letras ficam no arquivo `.just-listening/biblioteca.json` da pasta do app; se o mesmo item for mudado em dois aparelhos, vale a mudança mais recente. No app instalado, a conexão usa um código de copiar e colar.
- **Espaço:** as músicas ocupam espaço do aparelho. O app pede ao sistema para não apagar os dados automaticamente; veja o espaço usado no botão ⓘ. O plano grátis do Dropbox tem 2 GB (~300 músicas em MP3).
- **Formatos:** o que toca depende do aparelho. MP3, M4A/AAC e WAV tocam em todos.
- **Vídeos:** MP4 e MOV (câmera, WhatsApp, YouTube Studio, gravações de tela). WebM ainda não é suportado. Use só vídeos que você tem direito de usar.

## Histórico de versões

- **1.4.0:** importar vídeos MP4/MOV e guardar só o áudio (sem perda de qualidade)
- **1.3.0:** Modo Dormir, timer que espera a música terminar, Favoritas, letras, capa da playlist e sincronização de playlists/favoritas/letras entre aparelhos
- **1.2.0:** ordenar (Recentes, A–Z, Z–A), busca, abre nas Playlists com atalho "Todas as músicas"
- **1.1.0:** sincronização com o Dropbox (subpastas viram playlists)
- **1.0.1:** troca de faixa sem silêncio com a tela bloqueada no iPhone; atualização automática do app
- **1.0.0:** primeira versão: importar, playlists, repetir, aleatório, timer para dormir

## Próximos passos (ideias)

- "Tocar a seguir"
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
| `video-audio.js` | Extrai o áudio de vídeos MP4/MOV (carregado só quando precisa) |
| `sw.js` | Funcionamento offline |
| `manifest.webmanifest` | Nome, ícone e cores do app instalado |
