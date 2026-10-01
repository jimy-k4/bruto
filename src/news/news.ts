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
    id: 'soft-mode',
    date: '2026-10-01',
    text: {
      es: {
        title: 'Modo suave',
        body: 'El botón de las tres rayas, junto al del tema, cambia a líneas de 1 px, sombras bajas y difuminadas y menos contraste. Pesa menos con la pizarra llena y funciona en claro y en oscuro. El aspecto bruto sigue siendo el de siempre. Una petición de Product Hunt.',
      },
      en: {
        title: 'Soft mode',
        body: 'The three-line button, next to the theme one, switches to 1 px lines, low blurred shadows and less contrast. It’s lighter on a full board and works in light and dark. The bold look stays the default. Requested on Product Hunt.',
      },
      ca: {
        title: 'Mode suau',
        body: 'El botó de les tres ratlles, al costat del del tema, canvia a línies d’1 px, ombres baixes i difuminades i menys contrast. Pesa menys amb la pissarra plena i funciona en clar i en fosc. L’aspecte brut continua sent el de sempre. Una petició de Product Hunt.',
      },
      fr: {
        title: 'Mode doux',
        body: 'Le bouton aux trois traits, à côté de celui du thème, passe à des traits de 1 px, des ombres basses et floues et moins de contraste. C’est plus léger avec un tableau plein, en clair comme en sombre. L’aspect brut reste celui par défaut. Une demande venue de Product Hunt.',
      },
      de: {
        title: 'Sanfter Modus',
        body: 'Der Knopf mit den drei Strichen neben dem Theme-Knopf schaltet auf 1-px-Linien, flache, weiche Schatten und weniger Kontrast. Das wirkt bei einem vollen Board leichter und klappt hell wie dunkel. Der kräftige Look bleibt der Standard. Ein Wunsch von Product Hunt.',
      },
      'pt-BR': {
        title: 'Modo suave',
        body: 'O botão das três linhas, ao lado do botão do tema, muda para linhas de 1 px, sombras baixas e desfocadas e menos contraste. Fica mais leve com o quadro cheio e funciona no claro e no escuro. O visual bruto continua sendo o padrão. Um pedido do Product Hunt.',
      },
      ru: {
        title: 'Мягкий режим',
        body: 'Кнопка с тремя линиями рядом с кнопкой темы включает линии в 1 px, низкие размытые тени и меньше контраста. С полной доской так легче, и это работает в светлой и тёмной теме. Жёсткий вид остаётся по умолчанию. Просьба с Product Hunt.',
      },
      ja: {
        title: 'ソフトモード',
        body: 'テーマボタンの隣にある三本線のボタンで、1 px の線、低くぼかした影、控えめなコントラストに切り替わります。ノートの多いボードでも重く感じにくく、ライトでもダークでも使えます。標準はこれまでどおりの力強い見た目です。Product Hunt でいただいた要望です。',
      },
      zh: {
        title: '柔和模式',
        body: '主题按钮旁边的三条线按钮可切换为 1 px 线条、低而柔和的阴影和更低的对比度。看板满满时也不那么沉重，浅色和深色主题都适用。默认仍是原来的粗犷风格。这是 Product Hunt 上用户提出的建议。',
      },
    },
  },
  {
    id: 'db-lens-worker',
    date: '2026-09-30',
    text: {
      es: {
        title: 'Esquemas enormes sin congelar la ventana',
        body: 'La vista de base de datos lee los scripts varios a la vez y los analiza en segundo plano, así que Bruto sigue respondiendo mientras tanto, y te dice por dónde va: «Leyendo 812 de 2476 ficheros…». Un esquema Oracle de casi 2500 scripts ha pasado de tardar 7 s a 1,5 s.',
      },
      en: {
        title: 'Huge schemas without freezing the window',
        body: 'The database view reads scripts several at a time and parses them in the background, so Bruto keeps responding meanwhile, and tells you how far it is: “Reading 812 of 2,476 files…”. An Oracle schema of almost 2,500 scripts went from 7 s to 1.5 s.',
      },
      ca: {
        title: 'Esquemes enormes sense congelar la finestra',
        body: 'La vista de base de dades llegeix els scripts de diversos en diversos i els analitza en segon pla, així que Bruto continua responent mentrestant, i et diu per on va: «Llegint 812 de 2.476 fitxers…». Un esquema Oracle de gairebé 2.500 scripts ha passat de trigar 7 s a 1,5 s.',
      },
      fr: {
        title: 'Des schémas énormes sans figer la fenêtre',
        body: 'La vue base de données lit les scripts plusieurs à la fois et les analyse en arrière-plan : Bruto continue de répondre pendant ce temps et vous dit où il en est : « Lecture des fichiers : 812 sur 2 476… ». Un schéma Oracle de près de 2 500 scripts est passé de 7 s à 1,5 s.',
      },
      de: {
        title: 'Riesige Schemas, ohne dass das Fenster einfriert',
        body: 'Die Datenbankansicht liest mehrere Skripte gleichzeitig und analysiert sie im Hintergrund. Bruto reagiert währenddessen weiter und zeigt, wie weit es ist: „812 von 2.476 Dateien gelesen…“. Ein Oracle-Schema mit fast 2.500 Skripten braucht jetzt 1,5 s statt 7 s.',
      },
      'pt-BR': {
        title: 'Esquemas enormes sem congelar a janela',
        body: 'A visão de banco de dados lê vários scripts de uma vez e os analisa em segundo plano, então o Bruto continua respondendo enquanto isso, e mostra até onde chegou: “Lendo 812 de 2.476 arquivos…”. Um esquema Oracle de quase 2.500 scripts passou de 7 s para 1,5 s.',
      },
      ru: {
        title: 'Огромные схемы без зависания окна',
        body: 'Вид базы данных читает несколько скриптов сразу и разбирает их в фоне, так что Bruto не перестаёт отвечать и показывает, сколько осталось: «Читаем 812 из 2 476 файлов…». Схема Oracle почти из 2 500 скриптов теперь открывается за 1,5 с вместо 7 с.',
      },
      ja: {
        title: '巨大なスキーマでもウィンドウが固まらない',
        body: 'データベースビューはスクリプトを複数まとめて読み込み、バックグラウンドで解析します。その間も Bruto は操作でき、進み具合も表示されます:「ファイルを読み込み中… 812 / 2,476」。約 2,500 本のスクリプトを持つ Oracle スキーマが 7 秒から 1.5 秒になりました。',
      },
      zh: {
        title: '超大模式也不会让窗口卡住',
        body: '数据库视图会同时读取多个脚本，并在后台解析，期间 Bruto 仍可正常操作，还会显示进度：“正在读取文件… 812 / 2,476”。一个包含近 2,500 个脚本的 Oracle 模式，从 7 秒缩短到 1.5 秒。',
      },
    },
  },
  {
    id: 'mcp-worktrees',
    date: '2026-09-30',
    text: {
      es: {
        title: 'Los agentes en worktrees contestan en tu tablero',
        body: 'Si un agente trabaja en un `git worktree`, el MCP usa el tablero del checkout principal, el que tienes abierto, tanto si `.bruto/` está en git como si no. Sus respuestas ya no acaban en una copia que no ves. Con `--worktree-board`, cada worktree usa el suyo.',
      },
      en: {
        title: 'Agents in worktrees answer on your board',
        body: 'When an agent works in a `git worktree`, the MCP server uses the main checkout’s board, the one you have open, whether `.bruto/` is committed or not. Its answers no longer land on a copy you never see. With `--worktree-board`, each worktree keeps its own.',
      },
      ca: {
        title: 'Els agents en worktrees contesten al teu tauler',
        body: 'Si un agent treballa en un `git worktree`, el MCP fa servir el tauler del checkout principal, el que tens obert, tant si `.bruto/` és a git com si no. Les seves respostes ja no acaben en una còpia que no veus. Amb `--worktree-board`, cada worktree fa servir el seu.',
      },
      fr: {
        title: 'Les agents dans des worktrees répondent sur votre tableau',
        body: 'Quand un agent travaille dans un `git worktree`, le serveur MCP utilise le tableau du checkout principal, celui que vous avez ouvert, que `.bruto/` soit dans git ou non. Ses réponses n’atterrissent plus sur une copie que vous ne voyez pas. Avec `--worktree-board`, chaque worktree garde le sien.',
      },
      de: {
        title: 'Agenten in Worktrees antworten auf deinem Board',
        body: 'Arbeitet ein Agent in einem `git worktree`, nutzt der MCP-Server das Board des Haupt-Checkouts, das du offen hast, egal ob `.bruto/` in Git liegt oder nicht. Seine Antworten landen nicht mehr in einer Kopie, die du nie siehst. Mit `--worktree-board` behält jeder Worktree sein eigenes.',
      },
      'pt-BR': {
        title: 'Agentes em worktrees respondem no seu quadro',
        body: 'Quando um agente trabalha num `git worktree`, o servidor MCP usa o quadro do checkout principal, o que você tem aberto, esteja o `.bruto/` no git ou não. As respostas dele não caem mais numa cópia que você não vê. Com `--worktree-board`, cada worktree usa o seu.',
      },
      ru: {
        title: 'Агенты в worktree отвечают на твоей доске',
        body: 'Если агент работает в `git worktree`, MCP-сервер использует доску основного checkout — ту, что у тебя открыта, — неважно, лежит ли `.bruto/` в git. Его ответы больше не попадают в копию, которую ты не видишь. С `--worktree-board` у каждого worktree своя доска.',
      },
      ja: {
        title: 'worktree のエージェントもあなたのボードに回答',
        body: 'エージェントが `git worktree` で作業していても、MCP サーバーはメインのチェックアウト、つまりあなたが開いているボードを使います。`.bruto/` を git に入れていてもいなくても同じです。回答が見えないコピーに入ることはもうありません。`--worktree-board` を付けると各 worktree が自分のボードを使います。',
      },
      zh: {
        title: 'worktree 中的智能体也在你的看板上作答',
        body: '当智能体在 `git worktree` 中工作时，MCP 服务器会使用主检出目录的看板，也就是你打开的那个，无论 `.bruto/` 是否提交到 git。它的回答不会再落到你看不到的副本上。加上 `--worktree-board`，每个 worktree 使用自己的看板。',
      },
    },
  },
  {
    id: 'note-age',
    date: '2026-09-30',
    text: {
      es: {
        title: 'Cada nota lleva su edad y sus idas y vueltas',
        body: 'Una nota guarda cuándo se creó, pase por quien pase, y cuenta cada vez que la devuelves a la IA: **↩ 3** en la tarjeta. Una tarea que lleva una semana rebotando ya no parece nueva, y la IA sabe cuántas veces ha vuelto.',
      },
      en: {
        title: 'Every note keeps its age and its round trips',
        body: 'A note remembers when it was made, whoever it passes to, and counts each time you send it back to the AI: **↩ 3** on the card. A task that has bounced for a week no longer looks new, and the AI knows how often it came back.',
      },
      ca: {
        title: 'Cada nota porta la seva edat i les seves anades i tornades',
        body: 'Una nota guarda quan es va crear, passi per qui passi, i compta cada cop que la tornes a la IA: **↩ 3** a la targeta. Una tasca que fa una setmana que rebota ja no sembla nova, i la IA sap quantes vegades ha tornat.',
      },
      fr: {
        title: 'Chaque note garde son âge et ses allers-retours',
        body: 'Une note se souvient de sa création, quelles que soient les mains par lesquelles elle passe, et compte chaque renvoi à l’IA : **↩ 3** sur la carte. Une tâche qui rebondit depuis une semaine n’a plus l’air neuve, et l’IA sait combien de fois elle est revenue.',
      },
      de: {
        title: 'Jede Notiz behält ihr Alter und ihre Runden',
        body: 'Eine Notiz merkt sich, wann sie entstanden ist, egal wer sie gerade hat, und zählt jedes Mal, wenn du sie an die KI zurückschickst: **↩ 3** auf der Karte. Eine Aufgabe, die seit einer Woche hin und her geht, sieht nicht mehr neu aus, und die KI weiß, wie oft sie zurückkam.',
      },
      'pt-BR': {
        title: 'Cada nota guarda a idade e as idas e voltas',
        body: 'Uma nota lembra quando foi criada, passe por quem passar, e conta cada vez que você a devolve à IA: **↩ 3** no cartão. Uma tarefa que vai e volta há uma semana não parece mais nova, e a IA sabe quantas vezes ela voltou.',
      },
      ru: {
        title: 'Заметка помнит свой возраст и возвраты',
        body: 'Заметка помнит, когда её создали, у кого бы она ни была, и считает каждый возврат ИИ на доработку: **↩ 3** на карточке. Задача, которая неделю ходит туда-сюда, больше не выглядит новой, а ИИ знает, сколько раз она возвращалась.',
      },
      ja: {
        title: 'ノートが作成日と差し戻し回数を保持',
        body: 'ノートは誰の手に渡っても作成日時を保ち、AI に差し戻すたびに回数を数えます（カードに **↩ 3**）。1 週間行き来しているタスクが新しく見えることはもうなく、AI も何回戻ってきたかを把握できます。',
      },
      zh: {
        title: '每条笔记都记着年龄和往返次数',
        body: '笔记会记住创建时间，无论经过谁手，并统计每次退回给 AI 的次数：卡片上显示 **↩ 3**。来回折腾了一周的任务不再看起来像新的，AI 也知道它回来了几次。',
      },
    },
  },
  {
    id: 'sync-conflicts',
    date: '2026-09-30',
    text: {
      es: {
        title: 'Cuando tú y un agente cambiáis lo mismo',
        body: 'Si cambias un campo de una nota justo cuando un agente lo cambia también, se queda lo tuyo, pero ya no en silencio: te avisa con la opción de **usar el suyo**, la nota le dice al agente que su cambio se deshizo y el registro lo apunta.',
      },
      en: {
        title: 'When you and an agent change the same thing',
        body: 'If you change a field of a note just as an agent changes it too, yours stays, but no longer silently: you get a notice with the option to **use theirs**, the note tells the agent its change was undone, and the log records it.',
      },
      ca: {
        title: 'Quan tu i un agent canvieu el mateix',
        body: 'Si canvies un camp d’una nota just quan un agent també el canvia, es queda el teu, però ja no en silenci: t’avisa amb l’opció de **fer servir el seu**, la nota diu a l’agent que el seu canvi s’ha desfet i el registre ho apunta.',
      },
      fr: {
        title: 'Quand vous et un agent modifiez la même chose',
        body: 'Si vous modifiez un champ d’une note au moment où un agent le modifie aussi, votre version reste, mais plus en silence : un avis vous propose de **garder la leur**, la note dit à l’agent que son changement a été annulé, et le journal le consigne.',
      },
      de: {
        title: 'Wenn du und ein Agent dasselbe ändern',
        body: 'Änderst du ein Feld einer Notiz genau dann, wenn ein Agent es auch ändert, bleibt deine Änderung, aber nicht mehr stillschweigend: Du bekommst einen Hinweis mit der Option, **ihre zu übernehmen**, die Notiz sagt dem Agenten, dass seine Änderung rückgängig gemacht wurde, und das Protokoll hält es fest.',
      },
      'pt-BR': {
        title: 'Quando você e um agente mudam a mesma coisa',
        body: 'Se você muda um campo de uma nota justo quando um agente também o muda, fica a sua versão, mas não mais em silêncio: um aviso oferece **usar a deles**, a nota diz ao agente que a mudança dele foi desfeita e o registro anota.',
      },
      ru: {
        title: 'Когда ты и агент меняете одно и то же',
        body: 'Если ты меняешь поле заметки ровно тогда, когда его меняет и агент, остаётся твоя версия, но уже не молча: появляется уведомление с возможностью **взять их версию**, заметка сообщает агенту, что его изменение отменено, а журнал это записывает.',
      },
      ja: {
        title: 'あなたとエージェントが同じ箇所を変えたとき',
        body: 'エージェントが変更したのと同時にあなたがノートの同じ項目を変えると、あなたの変更が残ります。ただし黙ってではありません。**相手の変更を使う**選択肢付きで通知され、ノートはエージェントに変更が取り消されたことを伝え、記録にも残ります。',
      },
      zh: {
        title: '当你和智能体同时修改同一处',
        body: '如果你修改笔记某个字段时智能体也正好在改，会保留你的修改，但不再悄无声息：你会收到提示并可选择**使用对方的**，笔记会告诉智能体它的更改已被撤销，日志也会记录下来。',
      },
    },
  },
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
