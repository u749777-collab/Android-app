export type Category = "sport" | "study" | "leisure";
export type Tab = "today" | "stats" | "settings";

export type Task = {
  id: string;
  category: Category;
  title: string;
  detail: string;
  /** Full limit in seconds (leisure only). */
  durationSeconds?: number;
  /** Seconds left when the timer is paused (leisure only). */
  remainingSeconds?: number;
  /** Timestamp when a running timer finishes (leisure only). */
  endAt?: number | null;
  isRunning?: boolean;
  isCompleted: boolean;
  /** "HH:mm" reminder for sport and study tasks. */
  reminderTime?: string;
  /** Scheduled repeating reminder id. */
  reminderId?: string;
  /** Scheduled one-off timer id. */
  timerId?: string;
};

export type HistoryDay = { date: string; completed: number; total: number };

export type AppData = {
  date: string;
  tasks: Task[];
  history: HistoryDay[];
  notifications: boolean;
};
