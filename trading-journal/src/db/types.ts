export const SESSIONS = ['Asia', 'London', 'NY AM', 'NY PM'] as const;
export type Session = (typeof SESSIONS)[number];

export const TIMEFRAMES = ['1m', '5m', '15m', '1H', '2H', '4H'] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export type Position = 'Long' | 'Short';
export type Outcome = 'Win' | 'Loss' | 'BE';
export const OUTCOMES: Outcome[] = ['Win', 'Loss', 'BE'];

export type TagColor =
  | 'gray' | 'brown' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'red';
export const TAG_COLORS: TagColor[] = ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'];

export interface Tag {
  id: string;
  name: string;
  color: TagColor;
}

export interface ChecklistItem {
  id: string;
  label: string;
}

export interface TradeAccountEntry {
  accountId: string;
  contracts: number;
  pnl: number;
}

export interface Trade {
  id: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  session: Session;
  instrument: string;
  position: Position;
  accounts: TradeAccountEntry[];
  riskPct: number | null;
  plannedRR: number | null;
  realizedR: number | null;
  entry: number | null;
  stop: number | null;
  target: number | null;
  outcome: Outcome | null;
  confluences: string[]; // tag ids
  checklist: Record<string, boolean>;
  journal: string; // html
  moodPre: number | null;
  moodDuring: number | null;
  moodPost: number | null;
  emotions: string[]; // tag ids
  behaviours: string[]; // behaviour ids
  isDemo?: boolean;
  createdAt: number;
  updatedAt: number;
}

export type OwnerType = 'trade' | 'outlook';

export interface StoredImage {
  id: string;
  ownerType: OwnerType;
  ownerId: string;
  slot: Timeframe;
  blob: Blob;
  thumb: Blob;
  caption: string;
  width: number;
  height: number;
  isDemo?: boolean;
  createdAt: number;
}

export type Bias = 'Bullish' | 'Bearish' | 'Neutral';

export interface InstrumentBias {
  instrument: string;
  bias: Bias | null;
  reasoning: string;
}

export interface NewsEvent {
  id: string;
  time: string;
  title: string;
  impact: 'High' | 'Medium' | 'Low';
}

export interface Outlook {
  id: string; // = date YYYY-MM-DD
  date: string;
  biases: InstrumentBias[];
  keyLevels: string;
  drawOnLiquidity: string;
  news: NewsEvent[];
  notes: string; // html
  sleep: number | null; // 1-5
  stress: number | null;
  mood: number | null;
  go: boolean | null;
  goReason: string;
  followedBias: 'Yes' | 'Partly' | 'No' | null;
  learned: string; // html
  walkedAway: boolean;
  isDemo?: boolean;
  updatedAt: number;
}

export type AccountType = 'Eval' | 'Funded' | 'Live';
export type AccountStatus = 'Active' | 'Passed' | 'Failed' | 'Blown' | 'Paid out';
export type DrawdownType = 'Static' | 'Trailing EOD' | 'Trailing intraday';

export interface Account {
  id: string;
  firm: string;
  name: string;
  size: number;
  type: AccountType;
  status: AccountStatus;
  startDate: string;
  maxLoss: number; // $ drawdown allowed
  drawdownType: DrawdownType;
  dailyLossLimit: number | null;
  profitTarget: number | null;
  notes: string;
  isDemo?: boolean;
  createdAt: number;
}

export const EXPENSE_CATEGORIES = [
  'Eval purchase', 'Reset', 'Activation fee', 'Subscription', 'Data fee', 'Other',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface Expense {
  id: string;
  date: string;
  firm: string;
  category: ExpenseCategory;
  amount: number;
  note: string;
  isDemo?: boolean;
}

export interface Payout {
  id: string;
  date: string;
  firm: string;
  accountId: string | null;
  amount: number;
  note: string;
  isDemo?: boolean;
}

export interface Behaviour {
  id: string;
  label: string;
  positive?: boolean;
}

export interface AppSettings {
  id: 'app';
  currency: string;
  instruments: string[];
  confluences: Tag[];
  emotionTags: Tag[];
  checklist: ChecklistItem[];
  behaviours: Behaviour[];
  lastAccounts: string[];
  seeded: boolean;
}
