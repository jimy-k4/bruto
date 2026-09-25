import type { Language } from '../types'

/**
 * ATLAS, the example project behind "Try an example": a booking app for
 * climbing gyms with notes in every status, a Next.js front and Supabase
 * migrations, so the board and every lens have something to show. It lives in
 * the browser's private file system, so trying it needs no folder and no
 * permission. The landing page screenshots are taken from it too.
 */

interface DemoNoteText {
  title: string
  description: string
  aiResponse?: string
  feedback?: string
}

export interface DemoText {
  description: string
  aiContext: string
  designSystem: string
  notes: Record<DemoNoteKey, DemoNoteText>
}

type DemoNoteKey = 'calendar' | 'cancel' | 'double' | 'payments' | 'reminders' | 'tests'

export const DEMO_TEXTS: Record<Language, DemoText> = {
  en: {
    description: 'A booking app for climbing gyms. Next.js + Supabase.',
    aiContext:
      'Stack: Next.js 15, Supabase, Tailwind.\nDecisions: bookings are soft-deleted; prices in cents.\nCurrent state: payments done, calendar in progress.',
    designSystem: 'Design system',
    notes: {
      calendar: {
        title: 'Weekly calendar',
        description:
          "Show the gym's weekly slots.\nClick a slot to book it; full slots are greyed out.",
      },
      cancel: {
        title: 'Cancel a booking',
        description: 'Users can cancel up to 2 hours before the session.',
        aiResponse:
          'Added cancelBooking() with the 2-hour rule and a confirm dialog. Bookings get cancelled_at instead of being deleted. Covered by bookings.test.ts.',
      },
      double: {
        title: 'Double booking on refresh',
        description: 'Refreshing the checkout page creates the booking twice.',
        aiResponse: 'The booking is now created with an idempotency key.',
        feedback: 'Still happens on slow connections.',
      },
      payments: { title: 'Stripe payments', description: 'Checkout with Stripe; prices in cents.' },
      reminders: {
        title: 'Email reminders',
        description: 'Send a reminder 24 h before each session.',
      },
      tests: {
        title: 'Run the tests before finishing',
        description: 'npm test must pass before a note goes to review.',
      },
    },
  },
  es: {
    description: 'Una app de reservas para rocódromos. Next.js + Supabase.',
    aiContext:
      'Stack: Next.js 15, Supabase, Tailwind.\nDecisiones: las reservas se borran de forma lógica; precios en céntimos.\nEstado: pagos terminados, calendario en curso.',
    designSystem: 'Sistema de diseño',
    notes: {
      calendar: {
        title: 'Calendario semanal',
        description:
          'Mostrar los turnos semanales del rocódromo.\nPulsar un turno para reservarlo; los llenos salen en gris.',
      },
      cancel: {
        title: 'Cancelar una reserva',
        description: 'Se puede cancelar hasta 2 horas antes de la sesión.',
        aiResponse:
          'Añadido cancelBooking() con la regla de 2 horas y un diálogo de confirmación. Las reservas se marcan con cancelled_at en vez de borrarse. Cubierto por bookings.test.ts.',
      },
      double: {
        title: 'Reserva doble al recargar',
        description: 'Recargar la página de pago crea la reserva dos veces.',
        aiResponse: 'La reserva se crea ahora con una clave de idempotencia.',
        feedback: 'Sigue pasando con conexiones lentas.',
      },
      payments: {
        title: 'Pagos con Stripe',
        description: 'Pago con Stripe; precios en céntimos.',
      },
      reminders: {
        title: 'Recordatorios por email',
        description: 'Enviar un recordatorio 24 h antes de cada sesión.',
      },
      tests: {
        title: 'Pasar los tests antes de terminar',
        description: 'npm test debe pasar antes de que una nota vaya a revisión.',
      },
    },
  },
  ca: {
    description: 'Una app de reserves per a rocòdroms. Next.js + Supabase.',
    aiContext:
      'Stack: Next.js 15, Supabase, Tailwind.\nDecisions: les reserves s’esborren de forma lògica; preus en cèntims.\nEstat: pagaments acabats, calendari en curs.',
    designSystem: 'Sistema de disseny',
    notes: {
      calendar: {
        title: 'Calendari setmanal',
        description:
          'Mostrar els torns setmanals del rocòdrom.\nPrémer un torn per reservar-lo; els plens surten en gris.',
      },
      cancel: {
        title: 'Cancel·lar una reserva',
        description: 'Es pot cancel·lar fins a 2 hores abans de la sessió.',
        aiResponse:
          'Afegit cancelBooking() amb la regla de 2 hores i un diàleg de confirmació. Les reserves es marquen amb cancelled_at en lloc d’esborrar-se. Cobert per bookings.test.ts.',
      },
      double: {
        title: 'Reserva doble en recarregar',
        description: 'Recarregar la pàgina de pagament crea la reserva dues vegades.',
        aiResponse: 'La reserva es crea ara amb una clau d’idempotència.',
        feedback: 'Encara passa amb connexions lentes.',
      },
      payments: {
        title: 'Pagaments amb Stripe',
        description: 'Pagament amb Stripe; preus en cèntims.',
      },
      reminders: {
        title: 'Recordatoris per correu',
        description: 'Enviar un recordatori 24 h abans de cada sessió.',
      },
      tests: {
        title: 'Passar els tests abans d’acabar',
        description: 'npm test ha de passar abans que una nota vagi a revisió.',
      },
    },
  },
  fr: {
    description: 'Une app de réservation pour salles d’escalade. Next.js + Supabase.',
    aiContext:
      'Stack : Next.js 15, Supabase, Tailwind.\nDécisions : les réservations sont supprimées logiquement ; prix en centimes.\nÉtat : paiements terminés, calendrier en cours.',
    designSystem: 'Système de design',
    notes: {
      calendar: {
        title: 'Calendrier de la semaine',
        description:
          'Afficher les créneaux de la semaine.\nCliquer sur un créneau pour le réserver ; les créneaux complets sont grisés.',
      },
      cancel: {
        title: 'Annuler une réservation',
        description: 'On peut annuler jusqu’à 2 heures avant la séance.',
        aiResponse:
          'Ajout de cancelBooking() avec la règle des 2 heures et une confirmation. Les réservations reçoivent cancelled_at au lieu d’être supprimées. Couvert par bookings.test.ts.',
      },
      double: {
        title: 'Double réservation au rechargement',
        description: 'Recharger la page de paiement crée la réservation deux fois.',
        aiResponse: 'La réservation est maintenant créée avec une clé d’idempotence.',
        feedback: 'Ça arrive encore avec une connexion lente.',
      },
      payments: {
        title: 'Paiements Stripe',
        description: 'Paiement avec Stripe ; prix en centimes.',
      },
      reminders: {
        title: 'Rappels par e-mail',
        description: 'Envoyer un rappel 24 h avant chaque séance.',
      },
      tests: {
        title: 'Lancer les tests avant de finir',
        description: 'npm test doit passer avant qu’une note parte en revue.',
      },
    },
  },
  de: {
    description: 'Eine Buchungs-App für Kletterhallen. Next.js + Supabase.',
    aiContext:
      'Stack: Next.js 15, Supabase, Tailwind.\nEntscheidungen: Buchungen werden nur als gelöscht markiert; Preise in Cent.\nStand: Zahlungen fertig, Kalender in Arbeit.',
    designSystem: 'Designsystem',
    notes: {
      calendar: {
        title: 'Wochenkalender',
        description:
          'Die Wochentermine der Halle zeigen.\nEin Klick auf einen Termin bucht ihn; volle Termine sind ausgegraut.',
      },
      cancel: {
        title: 'Buchung stornieren',
        description: 'Stornieren geht bis 2 Stunden vor der Session.',
        aiResponse:
          'cancelBooking() mit der 2-Stunden-Regel und einem Bestätigungsdialog hinzugefügt. Buchungen bekommen cancelled_at, statt gelöscht zu werden. Abgedeckt durch bookings.test.ts.',
      },
      double: {
        title: 'Doppelbuchung beim Neuladen',
        description: 'Neuladen der Bezahlseite legt die Buchung doppelt an.',
        aiResponse: 'Die Buchung wird jetzt mit einem Idempotenzschlüssel angelegt.',
        feedback: 'Passiert bei langsamer Verbindung immer noch.',
      },
      payments: {
        title: 'Zahlungen mit Stripe',
        description: 'Bezahlen mit Stripe; Preise in Cent.',
      },
      reminders: {
        title: 'E-Mail-Erinnerungen',
        description: '24 Stunden vor jeder Session eine Erinnerung schicken.',
      },
      tests: {
        title: 'Vor dem Abschluss testen',
        description: 'npm test muss grün sein, bevor eine Notiz ins Review geht.',
      },
    },
  },
  'pt-BR': {
    description: 'Um app de reservas para academias de escalada. Next.js + Supabase.',
    aiContext:
      'Stack: Next.js 15, Supabase, Tailwind.\nDecisões: reservas são apagadas de forma lógica; preços em centavos.\nEstado: pagamentos prontos, calendário em andamento.',
    designSystem: 'Sistema de design',
    notes: {
      calendar: {
        title: 'Calendário semanal',
        description:
          'Mostrar os horários da semana.\nClicar num horário para reservar; os lotados ficam em cinza.',
      },
      cancel: {
        title: 'Cancelar uma reserva',
        description: 'Dá para cancelar até 2 horas antes da sessão.',
        aiResponse:
          'Adicionado cancelBooking() com a regra de 2 horas e um diálogo de confirmação. As reservas recebem cancelled_at em vez de serem apagadas. Coberto por bookings.test.ts.',
      },
      double: {
        title: 'Reserva dupla ao recarregar',
        description: 'Recarregar a página de pagamento cria a reserva duas vezes.',
        aiResponse: 'A reserva agora é criada com uma chave de idempotência.',
        feedback: 'Ainda acontece com conexão lenta.',
      },
      payments: {
        title: 'Pagamentos com Stripe',
        description: 'Pagamento com Stripe; preços em centavos.',
      },
      reminders: {
        title: 'Lembretes por e-mail',
        description: 'Enviar um lembrete 24 h antes de cada sessão.',
      },
      tests: {
        title: 'Rodar os testes antes de terminar',
        description: 'npm test tem que passar antes de uma nota ir para revisão.',
      },
    },
  },
  ru: {
    description: 'Приложение для бронирования в скалодромах. Next.js + Supabase.',
    aiContext:
      'Стек: Next.js 15, Supabase, Tailwind.\nРешения: брони удаляются логически; цены в центах.\nСостояние: оплата готова, календарь в работе.',
    designSystem: 'Дизайн-система',
    notes: {
      calendar: {
        title: 'Недельный календарь',
        description:
          'Показать слоты скалодрома на неделю.\nНажатие на слот бронирует его; заполненные — серые.',
      },
      cancel: {
        title: 'Отмена брони',
        description: 'Отменить можно не позже чем за 2 часа до занятия.',
        aiResponse:
          'Добавлен cancelBooking() с правилом двух часов и окном подтверждения. Брони получают cancelled_at, а не удаляются. Покрыто bookings.test.ts.',
      },
      double: {
        title: 'Двойная бронь при обновлении',
        description: 'Обновление страницы оплаты создаёт бронь дважды.',
        aiResponse: 'Теперь бронь создаётся с ключом идемпотентности.',
        feedback: 'При медленном соединении всё ещё повторяется.',
      },
      payments: {
        title: 'Оплата через Stripe',
        description: 'Оплата через Stripe; цены в центах.',
      },
      reminders: {
        title: 'Напоминания по почте',
        description: 'Отправлять напоминание за 24 часа до каждого занятия.',
      },
      tests: {
        title: 'Запускать тесты перед завершением',
        description: 'npm test должен проходить, прежде чем заметка уйдёт на проверку.',
      },
    },
  },
  ja: {
    description: 'クライミングジムの予約アプリ。Next.js + Supabase。',
    aiContext:
      'スタック：Next.js 15、Supabase、Tailwind。\n決定事項：予約は論理削除、価格はセント単位。\n現状：決済は完了、カレンダーは作業中。',
    designSystem: 'デザインシステム',
    notes: {
      calendar: {
        title: '週間カレンダー',
        description:
          'ジムの週間スロットを表示する。\nスロットをクリックで予約。満員のスロットはグレー表示。',
      },
      cancel: {
        title: '予約のキャンセル',
        description: 'セッションの2時間前までキャンセルできる。',
        aiResponse:
          '2時間ルールと確認ダイアログ付きの cancelBooking() を追加。予約は削除せず cancelled_at を記録。bookings.test.ts でテスト済み。',
      },
      double: {
        title: '再読み込みで二重予約',
        description: '決済ページを再読み込みすると予約が2件作られる。',
        aiResponse: '予約はべき等キー付きで作成するようにした。',
        feedback: '回線が遅いとまだ起きる。',
      },
      payments: { title: 'Stripe 決済', description: 'Stripe で決済。価格はセント単位。' },
      reminders: {
        title: 'メールでリマインド',
        description: '各セッションの24時間前にリマインドを送る。',
      },
      tests: {
        title: '終える前にテストを実行',
        description: 'ノートをレビューに回す前に npm test が通ること。',
      },
    },
  },
  zh: {
    description: '攀岩馆预约应用。Next.js + Supabase。',
    aiContext:
      '技术栈：Next.js 15、Supabase、Tailwind。\n决定：预约采用逻辑删除；价格以分为单位。\n现状：支付已完成，日历进行中。',
    designSystem: '设计系统',
    notes: {
      calendar: {
        title: '每周日历',
        description: '显示攀岩馆每周的时段。\n点击时段即可预约；满员时段显示为灰色。',
      },
      cancel: {
        title: '取消预约',
        description: '最晚可在课程开始前 2 小时取消。',
        aiResponse:
          '新增 cancelBooking()，包含 2 小时规则和确认对话框。预约用 cancelled_at 标记而不是删除。已由 bookings.test.ts 覆盖。',
      },
      double: {
        title: '刷新时重复预约',
        description: '刷新支付页面会创建两次预约。',
        aiResponse: '现在创建预约时使用幂等键。',
        feedback: '网络慢时仍然会出现。',
      },
      payments: { title: 'Stripe 支付', description: '使用 Stripe 结账；价格以分为单位。' },
      reminders: { title: '邮件提醒', description: '在每节课前 24 小时发送提醒。' },
      tests: { title: '完成前先跑测试', description: '笔记提交审核前，npm test 必须通过。' },
    },
  },
}

/** Where each note sits and what it holds besides its words. */
const NOTES: {
  key: DemoNoteKey
  id: string
  x: number
  y: number
  status: string
  colorTheme: string
  pattern: string
  filePaths?: string[]
  aiFilePaths?: string[]
  webUrl?: string
}[] = [
  {
    key: 'calendar',
    id: 'a11c9e20-0000-4000-8000-000000000001',
    x: 60,
    y: 60,
    status: 'in-progress',
    colorTheme: 'ochre',
    pattern: 'hatch',
    filePaths: ['app/calendar/page.tsx', 'components/SlotGrid.tsx'],
  },
  {
    key: 'cancel',
    id: 'b72f10aa-0000-4000-8000-000000000002',
    x: 420,
    y: 60,
    status: 'review',
    colorTheme: 'plum',
    pattern: 'dots',
    filePaths: ['app/bookings/actions.ts'],
    aiFilePaths: [
      'app/bookings/actions.ts',
      'components/BookingList.tsx',
      'supabase/migrations/20260210000000_cancel_bookings.sql',
    ],
  },
  {
    key: 'double',
    id: 'c3d4e5f6-0000-4000-8000-000000000003',
    x: 780,
    y: 60,
    status: 'changes-requested',
    colorTheme: 'wine',
    pattern: 'cross',
    filePaths: ['app/checkout/page.tsx'],
  },
  {
    key: 'payments',
    id: 'e1f2a3b4-0000-4000-8000-000000000005',
    x: 60,
    y: 430,
    status: 'done',
    colorTheme: 'moss',
    pattern: 'bands',
    filePaths: ['app/api/stripe/webhook/route.ts'],
  },
  {
    key: 'reminders',
    id: 'd9e8f7a6-0000-4000-8000-000000000004',
    x: 420,
    y: 430,
    status: 'todo',
    colorTheme: 'sand',
    pattern: 'grid',
    webUrl: 'https://resend.com/docs',
  },
  {
    key: 'tests',
    id: 'f0e1d2c3-0000-4000-8000-000000000006',
    x: 780,
    y: 430,
    status: 'loop',
    colorTheme: 'concrete',
    pattern: 'raw',
  },
]

const id = (key: DemoNoteKey) => NOTES.find((note) => note.key === key)!.id

/** The board of the example project, in the reader's language. */
export function demoWorkspace(language: Language) {
  const text = DEMO_TEXTS[language]

  return {
    version: 3,
    title: 'ATLAS',
    description: text.description,
    aiContext: text.aiContext,
    documentation: [
      {
        id: 'demo-design',
        name: text.designSystem,
        url: 'https://example.com/design',
        type: 'web',
      },
    ],
    statusStyles: {
      todo: { color: 'sand', pattern: 'grid' },
      'in-progress': { color: 'ochre', pattern: 'hatch' },
      review: { color: 'plum', pattern: 'dots' },
      'changes-requested': { color: 'wine', pattern: 'cross' },
      done: { color: 'moss', pattern: 'bands' },
    },
    notes: NOTES.map(({ key, ...note }, index) => ({
      filePaths: [],
      webUrl: '',
      images: [],
      zIndex: index + 1,
      ...note,
      ...text.notes[key],
    })),
    connections: [
      { id: 'demo-1', from: id('calendar'), to: id('cancel') },
      { id: 'demo-2', from: id('cancel'), to: id('double') },
      { id: 'demo-3', from: id('cancel'), to: id('reminders') },
    ],
  }
}

const code = (...lines: string[]) => `${lines.join('\n')}\n`

/** The code of the example project: enough for the web and database lenses. */
export const DEMO_FILES: Record<string, string> = {
  'package.json': code(
    '{',
    '  "name": "atlas",',
    '  "dependencies": { "next": "15.0.0", "react": "19.0.0", "@supabase/supabase-js": "2.45.0" }',
    '}',
  ),
  'app/layout.tsx': code(
    "import Header from '../components/Header'",
    'export default function Layout({ children }) {}',
  ),
  'app/page.tsx': code(
    "import Hero from '../components/Hero'",
    "import SlotGrid from '../components/SlotGrid'",
    'export default function Home() {}',
  ),
  'app/calendar/page.tsx': code(
    "import SlotGrid from '../../components/SlotGrid'",
    "import BookingDialog from '../../components/BookingDialog'",
    "import { useSlots } from '../../hooks/useSlots'",
    'export default function Calendar() {}',
  ),
  'app/bookings/page.tsx': code(
    "import BookingList from '../../components/BookingList'",
    'export default function Bookings() {}',
  ),
  'app/bookings/actions.ts': code("'use server'", 'export async function cancelBooking(id) {}'),
  'app/checkout/page.tsx': code(
    "import PriceTag from '../../components/PriceTag'",
    "import CheckoutForm from '../../components/CheckoutForm'",
    'export default function Checkout() {}',
  ),
  'app/gyms/[slug]/page.tsx': code(
    "import SlotGrid from '../../../components/SlotGrid'",
    "import PriceTag from '../../../components/PriceTag'",
    'export default function Gym() {}',
  ),
  'app/api/stripe/webhook/route.ts': code('export async function POST(request) {}'),
  'app/globals.css': code('body { margin: 0 }'),
  'components/Header.tsx': code('export default function Header() {}'),
  'components/Hero.tsx': code('export default function Hero() {}'),
  'components/SlotGrid.tsx': code(
    "import PriceTag from './PriceTag'",
    'export default function SlotGrid() {}',
  ),
  'components/BookingDialog.tsx': code(
    "import PriceTag from './PriceTag'",
    'export default function BookingDialog() {}',
  ),
  'components/BookingList.tsx': code('export default function BookingList() {}'),
  'components/PriceTag.tsx': code('export default function PriceTag() {}'),
  'components/CheckoutForm.tsx': code('export default function CheckoutForm() {}'),
  'hooks/useSlots.ts': code('export function useSlots() {}'),
  'lib/supabase.ts': code("import { createClient } from '@supabase/supabase-js'"),
  'lib/stripe.ts': code('export const stripe = {}'),
  'public/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>\n',
  'tests/bookings.test.ts': code("test('cancels up to 2 hours before', () => {})"),
  'supabase/migrations/20260101000000_init.sql': code(
    'create table public.gyms (',
    '  id uuid primary key default gen_random_uuid(),',
    '  name text not null,',
    '  slug text unique not null',
    ');',
    '',
    'create table public.slots (',
    '  id uuid primary key default gen_random_uuid(),',
    '  gym_id uuid not null references public.gyms (id),',
    '  starts_at timestamptz not null,',
    '  capacity int not null default 12',
    ');',
    '',
    'create table public.bookings (',
    '  id uuid primary key default gen_random_uuid(),',
    '  slot_id uuid not null references public.slots (id),',
    '  user_id uuid not null references auth.users (id),',
    '  created_at timestamptz default now()',
    ');',
    '',
    'alter table public.bookings enable row level security;',
    '',
    'create policy "Users see their own bookings" on public.bookings',
    '  for select using (auth.uid() = user_id);',
    'create policy "Users book for themselves" on public.bookings',
    '  for insert with check (auth.uid() = user_id);',
  ),
  'supabase/migrations/20260201000000_payments.sql': code(
    'create table public.payments (',
    '  id uuid primary key default gen_random_uuid(),',
    '  booking_id uuid not null references public.bookings (id),',
    '  amount_cents int not null,',
    '  stripe_id text unique',
    ');',
  ),
  'supabase/migrations/20260210000000_cancel_bookings.sql': code(
    'alter table public.bookings add column cancelled_at timestamptz;',
  ),
}

/** The folder the example project lives in, inside the browser's private file system. */
const DEMO_FOLDER = 'atlas'

/** Trying the example needs the private file system and writable files in it. */
export const supportsDemo = () =>
  typeof navigator !== 'undefined' &&
  typeof navigator.storage?.getDirectory === 'function' &&
  typeof FileSystemFileHandle !== 'undefined' &&
  'createWritable' in FileSystemFileHandle.prototype

/**
 * Whether the page was opened from a link to the example (`?demo`). The mark is
 * taken off the address, so reloading keeps the copy instead of starting over.
 */
export function takeDemoLink() {
  const url = new URL(window.location.href)

  if (!url.searchParams.has('demo')) return false

  url.searchParams.delete('demo')
  window.history.replaceState(window.history.state, '', url)
  return true
}

/** Writes a fresh copy of the example project and returns its folder. */
export async function createDemoProject(language: Language): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory()

  await root.removeEntry(DEMO_FOLDER, { recursive: true }).catch(() => undefined)

  const project = await root.getDirectoryHandle(DEMO_FOLDER, { create: true })
  const files = {
    ...DEMO_FILES,
    '.bruto/workspace.json': JSON.stringify(demoWorkspace(language), null, 2),
  }

  for (const [path, text] of Object.entries(files)) {
    const parts = path.split('/')
    let directory = project

    for (const part of parts.slice(0, -1)) {
      directory = await directory.getDirectoryHandle(part, { create: true })
    }

    const writable = await (
      await directory.getFileHandle(parts.at(-1)!, { create: true })
    ).createWritable()

    await writable.write(text)
    await writable.close()
  }

  return project
}
