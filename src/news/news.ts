import type { Language } from '../types'

export interface NewsText {
  title: string
  /** Markdown, shown like a note's text. */
  body: string
}

export interface NewsEntry {
  /** Stable: remembers what each person has already seen. */
  id: string
  /** YYYY-MM-DD */
  date: string
  /** Every language: a missing one is a type error, as in the rest of the app. */
  text: Record<Language, NewsText>
}

/**
 * What's new in Bruto, newest first. Every feature gets an entry the day it
 * ships: it tells people about it and shows the app is alive.
 */
export const NEWS: NewsEntry[] = [
  {
    id: 'cross-project-links',
    date: '2026-09-29',
    text: {
      es: {
        title: 'Notas vinculadas entre proyectos',
        body: 'Una nota puede **bloquear**, estar **bloqueada por** o **relacionarse con** otra de otro proyecto. Las dos lo muestran, la bloqueada lleva cinta de peligro hasta que la otra se cierra y un clic te lleva de una a otra.',
      },
      en: {
        title: 'Notes linked across projects',
        body: 'A note can **block**, be **blocked by** or **relate to** one in another project. Both show it, the blocked one wears hazard tape until the other is closed, and one click takes you from one to the other.',
      },
      ca: {
        title: 'Notes vinculades entre projectes',
        body: 'Una nota pot **bloquejar**, estar **bloquejada per** o **relacionar-se amb** una altra d’un altre projecte. Totes dues ho mostren, la bloquejada porta cinta de perill fins que l’altra es tanca i un clic et porta de l’una a l’altra.',
      },
      fr: {
        title: 'Des notes liées entre projets',
        body: 'Une note peut **bloquer**, être **bloquée par** ou être **liée à** une note d’un autre projet. Les deux l’affichent, la note bloquée porte un ruban de danger jusqu’à ce que l’autre soit fermée, et un clic mène de l’une à l’autre.',
      },
      de: {
        title: 'Notizen über Projekte hinweg verknüpft',
        body: 'Eine Notiz kann eine Notiz in einem anderen Projekt **blockieren**, von ihr **blockiert** sein oder mit ihr **verwandt** sein. Beide zeigen es, die blockierte trägt Warnband, bis die andere erledigt ist, und ein Klick führt von einer zur anderen.',
      },
      'pt-BR': {
        title: 'Notas vinculadas entre projetos',
        body: 'Uma nota pode **bloquear**, estar **bloqueada por** ou **relacionar-se com** outra de outro projeto. As duas mostram isso, a bloqueada usa fita de perigo até a outra ser fechada e um clique leva de uma à outra.',
      },
      ru: {
        title: 'Связи заметок между проектами',
        body: 'Заметка может **блокировать** заметку из другого проекта, быть **заблокированной** ею или быть **связанной** с ней. Обе это показывают, заблокированная помечена лентой, пока другая не закрыта, а один клик переносит от одной к другой.',
      },
      ja: {
        title: 'プロジェクトをまたいでノートをリンク',
        body: 'ノートは別プロジェクトのノートを**ブロック**したり、**ブロックされたり**、**関連付け**たりできます。両方に表示され、ブロックされた側は相手が完了するまで警告テープが付き、クリックひとつで行き来できます。',
      },
      zh: {
        title: '跨项目关联笔记',
        body: '笔记可以**阻塞**、**被阻塞于**或**关联**另一个项目中的笔记。双方都会显示，被阻塞的笔记会贴上警示胶带，直到对方关闭；点一下即可在两者间跳转。',
      },
    },
  },
  {
    id: 'format-help',
    date: '2026-09-29',
    text: {
      es: {
        title: 'Cómo dar formato, a un clic',
        body: 'Junto a la descripción y el feedback de una nota, **Formato** abre una chuleta con cada ejemplo de Markdown al lado de cómo se ve.',
      },
      en: {
        title: 'How to format, one click away',
        body: 'Next to a note’s description and feedback, **Formatting** opens a cheat sheet with each Markdown example beside how it looks.',
      },
      ca: {
        title: 'Com donar format, a un clic',
        body: 'Al costat de la descripció i el feedback d’una nota, **Format** obre una xuleta amb cada exemple de Markdown al costat de com es veu.',
      },
      fr: {
        title: 'La mise en forme, à un clic',
        body: 'À côté de la description et du feedback d’une note, **Mise en forme** ouvre un aide-mémoire avec chaque exemple Markdown et son rendu.',
      },
      de: {
        title: 'Formatieren, einen Klick entfernt',
        body: 'Neben Beschreibung und Feedback einer Notiz öffnet **Formatierung** einen Spickzettel mit jedem Markdown-Beispiel und wie es aussieht.',
      },
      'pt-BR': {
        title: 'Como formatar, a um clique',
        body: 'Ao lado da descrição e do feedback de uma nota, **Formatação** abre uma cola com cada exemplo de Markdown ao lado de como fica.',
      },
      ru: {
        title: 'Форматирование в один клик',
        body: 'Рядом с описанием и отзывом заметки кнопка **Форматирование** открывает шпаргалку: каждый пример Markdown рядом с тем, как он выглядит.',
      },
      ja: {
        title: '書式の書き方をワンクリックで',
        body: 'ノートの説明とフィードバックの横にある **書式** から、Markdown の例と表示結果を並べた早見表を開けます。',
      },
      zh: {
        title: '一键查看格式写法',
        body: '在笔记的描述和反馈旁，点击 **格式** 即可打开速查表，每个 Markdown 示例旁都有显示效果。',
      },
    },
  },
  {
    id: 'camera-per-project',
    date: '2026-09-29',
    text: {
      es: {
        title: 'Cada proyecto recuerda su vista',
        body: 'Al cambiar de proyecto y volver, la pizarra sigue donde la dejaste: mismo zoom y misma posición. También al recargar.',
      },
      en: {
        title: 'Each project remembers its view',
        body: 'Switch projects and come back: the board is where you left it, same zoom and position. After a reload too.',
      },
      ca: {
        title: 'Cada projecte recorda la seva vista',
        body: 'En canviar de projecte i tornar, la pissarra continua on la vas deixar: el mateix zoom i la mateixa posició. També en recarregar.',
      },
      fr: {
        title: 'Chaque projet garde sa vue',
        body: 'Changez de projet puis revenez : le tableau est là où vous l’aviez laissé, même zoom et même position. Même après un rechargement.',
      },
      de: {
        title: 'Jedes Projekt merkt sich seine Ansicht',
        body: 'Projekt wechseln und zurückkommen: Das Board ist, wo du es verlassen hast, mit gleichem Zoom und gleicher Position. Auch nach dem Neuladen.',
      },
      'pt-BR': {
        title: 'Cada projeto lembra sua visão',
        body: 'Troque de projeto e volte: o quadro está onde você o deixou, com o mesmo zoom e a mesma posição. Também depois de recarregar.',
      },
      ru: {
        title: 'Каждый проект помнит свой вид',
        body: 'Переключитесь на другой проект и вернитесь: доска там же, где вы её оставили, с тем же масштабом и положением. И после перезагрузки тоже.',
      },
      ja: {
        title: 'プロジェクトごとに表示位置を記憶',
        body: 'プロジェクトを切り替えて戻っても、ボードは離れたときのズームと位置のままです。再読み込みしても同じです。',
      },
      zh: {
        title: '每个项目记住自己的视图',
        body: '切换项目再回来，白板仍停在你离开时的位置，缩放和位置都不变。重新加载后也一样。',
      },
    },
  },
  {
    id: 'markdown-notes',
    date: '2026-09-29',
    text: {
      es: {
        title: 'Las notas entienden Markdown',
        body: 'Títulos, listas, **negrita**, *cursiva*, enlaces, tablas y citas se ven con formato en la descripción, la respuesta de la IA y el feedback.',
      },
      en: {
        title: 'Notes understand Markdown',
        body: 'Headings, lists, **bold**, *italic*, links, tables and quotes show formatted in the description, the AI response and the feedback.',
      },
      ca: {
        title: 'Les notes entenen Markdown',
        body: 'Títols, llistes, **negreta**, *cursiva*, enllaços, taules i cites es veuen amb format a la descripció, la resposta de la IA i el feedback.',
      },
      fr: {
        title: 'Les notes comprennent le Markdown',
        body: 'Titres, listes, **gras**, *italique*, liens, tableaux et citations s’affichent mis en forme dans la description, la réponse de l’IA et le feedback.',
      },
      de: {
        title: 'Notizen verstehen Markdown',
        body: 'Überschriften, Listen, **fett**, *kursiv*, Links, Tabellen und Zitate erscheinen formatiert in Beschreibung, KI-Antwort und Feedback.',
      },
      'pt-BR': {
        title: 'As notas entendem Markdown',
        body: 'Títulos, listas, **negrito**, *itálico*, links, tabelas e citações aparecem formatados na descrição, na resposta da IA e no feedback.',
      },
      ru: {
        title: 'Заметки понимают Markdown',
        body: 'Заголовки, списки, **жирный**, *курсив*, ссылки, таблицы и цитаты отображаются с форматированием в описании, ответе ИИ и отзыве.',
      },
      ja: {
        title: 'ノートが Markdown に対応',
        body: '見出し、リスト、**太字**、*斜体*、リンク、表、引用が、説明・AI の回答・フィードバックで整形表示されます。',
      },
      zh: {
        title: '笔记支持 Markdown',
        body: '标题、列表、**粗体**、*斜体*、链接、表格和引用会在描述、AI 回复和反馈中按格式显示。',
      },
    },
  },
  {
    id: 'next-api-lens',
    date: '2026-09-29',
    text: {
      es: {
        title: 'Vista API para Next.js',
        body: 'La vista de estructura dibuja las rutas `route.ts`, `pages/api` y las server actions, con un candado en las que piden sesión.',
      },
      en: {
        title: 'API lens for Next.js',
        body: 'The structure view draws `route.ts` handlers, `pages/api` and server actions, with a lock on the ones that need a session.',
      },
      ca: {
        title: 'Vista API per a Next.js',
        body: 'La vista d’estructura dibuixa les rutes `route.ts`, `pages/api` i les server actions, amb un cadenat a les que demanen sessió.',
      },
      fr: {
        title: 'Vue API pour Next.js',
        body: 'La vue structure dessine les routes `route.ts`, `pages/api` et les server actions, avec un cadenas sur celles qui exigent une session.',
      },
      de: {
        title: 'API-Ansicht für Next.js',
        body: 'Die Strukturansicht zeigt `route.ts`-Handler, `pages/api` und Server Actions, mit einem Schloss bei denen, die eine Anmeldung verlangen.',
      },
      'pt-BR': {
        title: 'Visão de API para Next.js',
        body: 'A visão de estrutura desenha as rotas `route.ts`, `pages/api` e as server actions, com um cadeado nas que exigem sessão.',
      },
      ru: {
        title: 'Вид API для Next.js',
        body: 'Вид структуры показывает обработчики `route.ts`, `pages/api` и server actions, с замком на тех, что требуют входа.',
      },
      ja: {
        title: 'Next.js の API ビュー',
        body: '構造ビューが `route.ts`、`pages/api`、サーバーアクションを描き、ログインが必要なものには鍵を付けます。',
      },
      zh: {
        title: 'Next.js 的 API 视图',
        body: '结构视图会画出 `route.ts`、`pages/api` 和 server actions，需要登录的会带锁。',
      },
    },
  },
  {
    id: 'mcp-server',
    date: '2026-09-29',
    text: {
      es: {
        title: 'Bruto como servidor MCP',
        body: 'Con `bruto-mcp`, Claude Code y otros agentes leen el tablero, marcan en qué nota trabajan y la contestan sin tocar el JSON.',
      },
      en: {
        title: 'Bruto as an MCP server',
        body: 'With `bruto-mcp`, Claude Code and other agents read the board, mark the note they are on and answer it without touching the JSON.',
      },
      ca: {
        title: 'Bruto com a servidor MCP',
        body: 'Amb `bruto-mcp`, Claude Code i altres agents llegeixen la pissarra, marquen en quina nota treballen i la contesten sense tocar el JSON.',
      },
      fr: {
        title: 'Bruto comme serveur MCP',
        body: 'Avec `bruto-mcp`, Claude Code et d’autres agents lisent le tableau, marquent la note en cours et y répondent sans toucher au JSON.',
      },
      de: {
        title: 'Bruto als MCP-Server',
        body: 'Mit `bruto-mcp` lesen Claude Code und andere Agenten das Board, markieren ihre aktuelle Notiz und beantworten sie, ohne das JSON anzufassen.',
      },
      'pt-BR': {
        title: 'Bruto como servidor MCP',
        body: 'Com `bruto-mcp`, o Claude Code e outros agentes leem o quadro, marcam a nota em que trabalham e a respondem sem mexer no JSON.',
      },
      ru: {
        title: 'Bruto как MCP-сервер',
        body: 'С `bruto-mcp` Claude Code и другие агенты читают доску, отмечают заметку, над которой работают, и отвечают на неё, не трогая JSON.',
      },
      ja: {
        title: 'Bruto が MCP サーバーに',
        body: '`bruto-mcp` があれば、Claude Code などのエージェントが JSON に触れずにボードを読み、作業中のノートを示して回答できます。',
      },
      zh: {
        title: 'Bruto 成为 MCP 服务器',
        body: '借助 `bruto-mcp`，Claude Code 等代理可以读取白板、标记正在处理的笔记并直接回复，无需改动 JSON。',
      },
    },
  },
  {
    id: 'several-links',
    date: '2026-09-29',
    text: {
      es: {
        title: 'Varios enlaces por nota',
        body: 'Una nota guarda todos los enlaces que necesite. Pega varios a la vez y cada uno va a su campo.',
      },
      en: {
        title: 'Several links per note',
        body: 'A note holds as many links as it needs. Paste several at once and each one gets its own field.',
      },
      ca: {
        title: 'Diversos enllaços per nota',
        body: 'Una nota guarda tots els enllaços que calgui. Enganxa’n diversos alhora i cadascun va al seu camp.',
      },
      fr: {
        title: 'Plusieurs liens par note',
        body: 'Une note garde autant de liens qu’il faut. Collez-en plusieurs d’un coup et chacun a son propre champ.',
      },
      de: {
        title: 'Mehrere Links pro Notiz',
        body: 'Eine Notiz nimmt so viele Links auf wie nötig. Füge mehrere auf einmal ein, und jeder bekommt sein eigenes Feld.',
      },
      'pt-BR': {
        title: 'Vários links por nota',
        body: 'Uma nota guarda quantos links precisar. Cole vários de uma vez e cada um vai para o seu campo.',
      },
      ru: {
        title: 'Несколько ссылок в заметке',
        body: 'В заметке может быть сколько угодно ссылок. Вставьте несколько сразу, и каждая попадёт в своё поле.',
      },
      ja: {
        title: 'ノートに複数のリンク',
        body: 'ノートに必要なだけリンクを追加できます。まとめて貼り付けると、それぞれが別の欄に入ります。',
      },
      zh: {
        title: '每条笔记可放多个链接',
        body: '一条笔记可以保存任意数量的链接。一次粘贴多个，每个会进入自己的输入框。',
      },
    },
  },
  {
    id: 'alt-projects',
    date: '2026-09-28',
    text: {
      es: {
        title: 'Mantén Alt para ver tus proyectos',
        body: 'Con Alt pulsada aparecen los proyectos abiertos con su número: Alt+1, Alt+2… salta a cada uno.',
      },
      en: {
        title: 'Hold Alt to see your projects',
        body: 'Holding Alt shows the open projects with their numbers: Alt+1, Alt+2… jumps to each one.',
      },
      ca: {
        title: 'Mantén Alt per veure els teus projectes',
        body: 'Amb Alt premuda apareixen els projectes oberts amb el seu número: Alt+1, Alt+2… salta a cadascun.',
      },
      fr: {
        title: 'Maintenez Alt pour voir vos projets',
        body: 'Alt enfoncée affiche les projets ouverts avec leur numéro : Alt+1, Alt+2… passe à chacun.',
      },
      de: {
        title: 'Alt halten zeigt deine Projekte',
        body: 'Mit gehaltener Alt-Taste erscheinen die offenen Projekte mit ihrer Nummer: Alt+1, Alt+2… springt zu jedem.',
      },
      'pt-BR': {
        title: 'Segure Alt para ver seus projetos',
        body: 'Com Alt pressionada aparecem os projetos abertos com seu número: Alt+1, Alt+2… vai para cada um.',
      },
      ru: {
        title: 'Удерживайте Alt, чтобы увидеть проекты',
        body: 'При нажатой Alt видны открытые проекты с номерами: Alt+1, Alt+2… переключает на каждый.',
      },
      ja: {
        title: 'Alt を押してプロジェクトを表示',
        body: 'Alt を押している間、開いているプロジェクトが番号付きで表示されます。Alt+1、Alt+2… でそれぞれに移動します。',
      },
      zh: {
        title: '按住 Alt 查看项目',
        body: '按住 Alt 会显示已打开的项目及其编号：Alt+1、Alt+2… 可跳到对应项目。',
      },
    },
  },
  {
    id: 'code-blocks',
    date: '2026-09-25',
    text: {
      es: {
        title: 'Código con botón de copiar',
        body: 'Los comandos y el código de una nota van en su caja con un botón para copiarlos, y la búsqueda filtra las notas que tienen código.',
      },
      en: {
        title: 'Code with a copy button',
        body: 'Commands and code in a note get their own box with a copy button, and search can filter the notes that contain code.',
      },
      ca: {
        title: 'Codi amb botó de copiar',
        body: 'Les ordres i el codi d’una nota van a la seva caixa amb un botó per copiar-los, i la cerca filtra les notes que tenen codi.',
      },
      fr: {
        title: 'Du code avec un bouton copier',
        body: 'Les commandes et le code d’une note ont leur propre boîte avec un bouton pour les copier, et la recherche filtre les notes qui en contiennent.',
      },
      de: {
        title: 'Code mit Kopierknopf',
        body: 'Befehle und Code einer Notiz stehen in einem eigenen Kasten mit Kopierknopf, und die Suche filtert Notizen mit Code.',
      },
      'pt-BR': {
        title: 'Código com botão de copiar',
        body: 'Comandos e código de uma nota ficam na sua caixa com um botão para copiá-los, e a busca filtra as notas que têm código.',
      },
      ru: {
        title: 'Код с кнопкой копирования',
        body: 'Команды и код в заметке показываются в отдельном блоке с кнопкой копирования, а поиск умеет отбирать заметки с кодом.',
      },
      ja: {
        title: 'コピーボタン付きのコード',
        body: 'ノート内のコマンドやコードはコピーボタン付きの枠に表示され、検索でコードを含むノートを絞り込めます。',
      },
      zh: {
        title: '带复制按钮的代码',
        body: '笔记中的命令和代码会显示在带复制按钮的框中，搜索也可以筛选包含代码的笔记。',
      },
    },
  },
]

const SEEN_KEY = 'bruto-news-seen'

/** The ids already seen here. Unreadable storage counts as nothing seen. */
export function seenNews(): Set<string> {
  try {
    const seen: unknown = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]')

    return new Set(Array.isArray(seen) ? seen.filter((id) => typeof id === 'string') : [])
  } catch {
    return new Set()
  }
}

export function markNewsSeen(entries: NewsEntry[] = NEWS) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(entries.map((entry) => entry.id)))
  } catch {
    // Without storage, the news only stay read while the page is open.
  }
}

export const unseenNews = (seen: Set<string>, entries: NewsEntry[] = NEWS) =>
  entries.filter((entry) => !seen.has(entry.id))
