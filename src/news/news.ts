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
    id: 'agent-audit',
    date: '2026-09-30',
    text: {
      es: {
        title: 'Quién hizo qué: registro de los agentes',
        body: 'Cada nota que un agente contesta, mueve o crea por MCP dice quién fue y cuándo, y cada cambio queda en `.bruto/log.jsonl` con el commit y la huella de los ficheros. Y puedes marcar una nota como **solo lectura para agentes**.',
      },
      en: {
        title: 'Who did what: an audit log for agents',
        body: 'Every note an agent answers, moves or creates over MCP says who did it and when, and every change is logged in `.bruto/log.jsonl` with the commit and a fingerprint of the files. You can also mark a note **read only for agents**.',
      },
      ca: {
        title: 'Qui ha fet què: registre dels agents',
        body: 'Cada nota que un agent contesta, mou o crea per MCP diu qui ha estat i quan, i cada canvi queda a `.bruto/log.jsonl` amb el commit i l’empremta dels fitxers. I pots marcar una nota com a **només lectura per als agents**.',
      },
      fr: {
        title: 'Qui a fait quoi : le journal des agents',
        body: 'Chaque note qu’un agent traite, déplace ou crée via MCP indique qui l’a fait et quand, et chaque changement est consigné dans `.bruto/log.jsonl` avec le commit et l’empreinte des fichiers. Vous pouvez aussi mettre une note en **lecture seule pour les agents**.',
      },
      de: {
        title: 'Wer hat was gemacht: das Agenten-Protokoll',
        body: 'Jede Notiz, die ein Agent über MCP beantwortet, verschiebt oder anlegt, zeigt, wer es war und wann, und jede Änderung steht in `.bruto/log.jsonl` mit dem Commit und einem Fingerabdruck der Dateien. Außerdem kannst du eine Notiz **für Agenten nur lesbar** machen.',
      },
      'pt-BR': {
        title: 'Quem fez o quê: registro dos agentes',
        body: 'Cada nota que um agente responde, move ou cria via MCP diz quem foi e quando, e cada mudança fica em `.bruto/log.jsonl` com o commit e a impressão digital dos arquivos. E você pode marcar uma nota como **somente leitura para agentes**.',
      },
      ru: {
        title: 'Кто что сделал: журнал агентов',
        body: 'Каждая заметка, на которую агент ответил через MCP, которую перенёс или создал, показывает, кто это был и когда, а каждое изменение записывается в `.bruto/log.jsonl` с коммитом и отпечатком файлов. А ещё заметку можно сделать **только для чтения агентами**.',
      },
      ja: {
        title: '誰が何をしたか：エージェントの記録',
        body: 'エージェントが MCP 経由で回答・移動・作成したノートには、誰がいつ行ったかが表示され、すべての変更がコミットとファイルの指紋付きで `.bruto/log.jsonl` に記録されます。ノートを**エージェントは閲覧のみ**にすることもできます。',
      },
      zh: {
        title: '谁做了什么：智能体日志',
        body: '智能体通过 MCP 作答、移动或创建的每条笔记都会显示是谁、何时做的，每次更改都会连同提交和文件指纹记录在 `.bruto/log.jsonl` 中。你还可以把笔记设为**智能体仅可读**。',
      },
    },
  },
  {
    id: 'undeclared-tables',
    date: '2026-09-29',
    text: {
      es: {
        title: 'También las tablas sin CREATE TABLE',
        body: 'El buscador de tablas encuentra también las que tu código usa (`INSERT`, `UPDATE`, `FROM`, `%TYPE`…) aunque ningún script las cree, con los ficheros que las usan. Y la vista de base de datos lee los `.TBL` de TOAD.',
      },
      en: {
        title: 'Tables with no CREATE TABLE, found too',
        body: 'Table search also finds the tables your code uses (`INSERT`, `UPDATE`, `FROM`, `%TYPE`…) even when no script creates them, with the files that use them. And the database lens reads TOAD’s `.TBL` files.',
      },
      ca: {
        title: 'També les taules sense CREATE TABLE',
        body: 'El cercador de taules també troba les que el teu codi fa servir (`INSERT`, `UPDATE`, `FROM`, `%TYPE`…) encara que cap script no les creï, amb els fitxers que les fan servir. I la vista de base de dades llegeix els `.TBL` de TOAD.',
      },
      fr: {
        title: 'Les tables sans CREATE TABLE aussi',
        body: 'La recherche de tables trouve aussi celles que votre code utilise (`INSERT`, `UPDATE`, `FROM`, `%TYPE`…) même si aucun script ne les crée, avec les fichiers qui les utilisent. Et la vue base de données lit les `.TBL` de TOAD.',
      },
      de: {
        title: 'Auch Tabellen ohne CREATE TABLE',
        body: 'Die Tabellensuche findet auch die Tabellen, die dein Code benutzt (`INSERT`, `UPDATE`, `FROM`, `%TYPE`…), selbst wenn kein Skript sie anlegt, samt den Dateien, die sie benutzen. Und die Datenbankansicht liest die `.TBL`-Dateien von TOAD.',
      },
      'pt-BR': {
        title: 'Tabelas sem CREATE TABLE também',
        body: 'A busca de tabelas também encontra as que seu código usa (`INSERT`, `UPDATE`, `FROM`, `%TYPE`…) mesmo que nenhum script as crie, com os arquivos que as usam. E a visão de banco de dados lê os `.TBL` do TOAD.',
      },
      ru: {
        title: 'И таблицы без CREATE TABLE',
        body: 'Поиск таблиц находит и те, что использует ваш код (`INSERT`, `UPDATE`, `FROM`, `%TYPE`…), даже если ни один скрипт их не создаёт, вместе с файлами, где они используются. А вид базы данных читает файлы `.TBL` из TOAD.',
      },
      ja: {
        title: 'CREATE TABLE のないテーブルも',
        body: 'テーブル検索は、どのスクリプトも作成していなくても、コードが使っているテーブル（`INSERT`、`UPDATE`、`FROM`、`%TYPE`…）を、使っているファイルと一緒に見つけます。データベースビューは TOAD の `.TBL` ファイルも読み込みます。',
      },
      zh: {
        title: '没有 CREATE TABLE 的表也能找到',
        body: '表搜索现在也能找到代码中用到（`INSERT`、`UPDATE`、`FROM`、`%TYPE`…）但没有任何脚本创建的表，并列出使用它们的文件。数据库视图也会读取 TOAD 的 `.TBL` 文件。',
      },
    },
  },
  {
    id: 'table-search',
    date: '2026-09-29',
    text: {
      es: {
        title: 'Buscador de tablas',
        body: 'La vista de base de datos tiene buscador (**Ctrl+F**): encuentra una tabla por su nombre o por una columna entre cientos, te lleva a ella en el diagrama y copia su nombre para citarla en una nota.',
      },
      en: {
        title: 'Table search',
        body: 'The database lens has a search (**Ctrl+F**): it finds a table by name or by a column among hundreds, takes you to it on the diagram and copies its name to cite it in a note.',
      },
      ca: {
        title: 'Cercador de taules',
        body: 'La vista de base de dades té cercador (**Ctrl+F**): troba una taula pel nom o per una columna entre centenars, t’hi porta al diagrama i en copia el nom per citar-la en una nota.',
      },
      fr: {
        title: 'Recherche de tables',
        body: 'La vue base de données a une recherche (**Ctrl+F**) : elle trouve une table par son nom ou par une colonne parmi des centaines, vous y mène sur le diagramme et copie son nom pour la citer dans une note.',
      },
      de: {
        title: 'Tabellensuche',
        body: 'Die Datenbankansicht hat eine Suche (**Strg+F**): Sie findet eine Tabelle unter Hunderten nach Name oder Spalte, führt dich im Diagramm hin und kopiert ihren Namen, um sie in einer Notiz zu nennen.',
      },
      'pt-BR': {
        title: 'Busca de tabelas',
        body: 'A visão de banco de dados tem busca (**Ctrl+F**): encontra uma tabela pelo nome ou por uma coluna entre centenas, leva você até ela no diagrama e copia o nome para citá-la numa nota.',
      },
      ru: {
        title: 'Поиск таблиц',
        body: 'В виде базы данных есть поиск (**Ctrl+F**): он находит таблицу среди сотен по имени или столбцу, показывает её на диаграмме и копирует имя, чтобы упомянуть её в заметке.',
      },
      ja: {
        title: 'テーブル検索',
        body: 'データベースビューに検索（**Ctrl+F**）が付きました。数百のテーブルから名前や列で探し、図の上で移動し、ノートで引用できるよう名前をコピーします。',
      },
      zh: {
        title: '表搜索',
        body: '数据库视图新增搜索（**Ctrl+F**）：在数百张表中按表名或列名查找，在图中跳转到该表，并可复制表名以便在笔记中引用。',
      },
    },
  },
  {
    id: 'note-kinds',
    date: '2026-09-29',
    text: {
      es: {
        title: 'Bug y Regla son tipos, no estados',
        body: 'Cada nota tiene un **tipo** (tarea, bug o regla) además de su estado. Un bug avanza por los estados como cualquier tarea y su cabecera dice BUG. Una regla se aplica en cada tarea hasta que la cierras. Los tableros antiguos se convierten solos.',
      },
      en: {
        title: 'Bug and Rule are kinds, not statuses',
        body: 'Every note has a **kind** (task, bug or rule) besides its status. A bug moves through the statuses like any task and its header says BUG. A rule applies on every task until you close it. Older boards convert on their own.',
      },
      ca: {
        title: 'Error i Regla són tipus, no estats',
        body: 'Cada nota té un **tipus** (tasca, error o regla) a més del seu estat. Un error avança pels estats com qualsevol tasca i la capçalera ho diu. Una regla s’aplica a cada tasca fins que la tanques. Les pissarres antigues es converteixen soles.',
      },
      fr: {
        title: 'Bogue et Règle sont des types, pas des statuts',
        body: 'Chaque note a un **type** (tâche, bogue ou règle) en plus de son statut. Un bogue suit les statuts comme toute tâche et son en-tête l’indique. Une règle s’applique à chaque tâche jusqu’à ce que vous la fermiez. Les anciens tableaux se convertissent seuls.',
      },
      de: {
        title: 'Fehler und Regel sind Arten, keine Status',
        body: 'Jede Notiz hat neben ihrem Status eine **Art** (Aufgabe, Fehler oder Regel). Ein Fehler durchläuft die Status wie jede Aufgabe, und die Kopfzeile zeigt es an. Eine Regel gilt für jede Aufgabe, bis du sie schließt. Ältere Boards werden von selbst umgestellt.',
      },
      'pt-BR': {
        title: 'Defeito e Regra são tipos, não status',
        body: 'Cada nota tem um **tipo** (tarefa, defeito ou regra) além do status. Um defeito passa pelos status como qualquer tarefa e o cabeçalho mostra isso. Uma regra vale em cada tarefa até você fechá-la. Quadros antigos se convertem sozinhos.',
      },
      ru: {
        title: 'Ошибка и Правило — это типы, а не статусы',
        body: 'У каждой заметки есть **тип** (задача, ошибка или правило) помимо статуса. Ошибка проходит статусы как любая задача, и это видно в заголовке. Правило применяется в каждой задаче, пока вы его не закроете. Старые доски преобразуются сами.',
      },
      ja: {
        title: 'バグとルールはステータスではなく種類に',
        body: 'ノートにはステータスとは別に**種類**（タスク、バグ、ルール）があります。バグは通常のタスクと同じようにステータスを進み、見出しにバグと表示されます。ルールは閉じるまですべてのタスクで適用されます。古いボードは自動で変換されます。',
      },
      zh: {
        title: '缺陷和规则变成了类型，而不是状态',
        body: '每条笔记除了状态，还有**类型**（任务、缺陷或规则）。缺陷像普通任务一样流转状态，标题上会标明。规则会在每个任务中生效，直到你关闭它。旧白板会自动转换。',
      },
    },
  },
  {
    id: 'alt-drag-duplicate',
    date: '2026-09-29',
    text: {
      es: {
        title: 'Alt + arrastrar duplica',
        body: 'Arrastra una nota (o varias seleccionadas) con **Alt** pulsada: la original se queda en su sitio y te llevas la copia. Un solo Ctrl+Z lo deshace.',
      },
      en: {
        title: 'Alt + drag duplicates',
        body: 'Drag a note (or several selected ones) while holding **Alt**: the original stays put and you carry the copy. One Ctrl+Z undoes it.',
      },
      ca: {
        title: 'Alt + arrossegar duplica',
        body: 'Arrossega una nota (o diverses de seleccionades) amb **Alt** premuda: l’original es queda al seu lloc i t’emportes la còpia. Un sol Ctrl+Z ho desfà.',
      },
      fr: {
        title: 'Alt + glisser duplique',
        body: 'Faites glisser une note (ou plusieurs sélectionnées) avec **Alt** enfoncée : l’originale reste en place et vous emportez la copie. Un seul Ctrl+Z l’annule.',
      },
      de: {
        title: 'Alt + Ziehen dupliziert',
        body: 'Ziehe eine Notiz (oder mehrere ausgewählte) mit gedrückter **Alt**-Taste: Das Original bleibt, du trägst die Kopie. Ein einziges Strg+Z macht es rückgängig.',
      },
      'pt-BR': {
        title: 'Alt + arrastar duplica',
        body: 'Arraste uma nota (ou várias selecionadas) com **Alt** pressionada: a original fica no lugar e você leva a cópia. Um só Ctrl+Z desfaz.',
      },
      ru: {
        title: 'Alt + перетаскивание дублирует',
        body: 'Перетащите заметку (или несколько выделенных) с зажатой **Alt**: оригинал останется на месте, а вы перенесёте копию. Один Ctrl+Z всё отменит.',
      },
      ja: {
        title: 'Alt + ドラッグで複製',
        body: '**Alt** を押しながらノート（または選択した複数のノート）をドラッグすると、元はその場に残り、コピーを動かせます。Ctrl+Z 一回で元に戻せます。',
      },
      zh: {
        title: 'Alt + 拖动即可复制',
        body: '按住 **Alt** 拖动笔记（或多条已选笔记）：原笔记留在原处，你拖走的是副本。按一次 Ctrl+Z 即可撤销。',
      },
    },
  },
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
