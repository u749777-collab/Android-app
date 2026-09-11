import { AppData, Category, Task } from "./types";

export const STORE_KEY = "dayflow:v2";

export const CATEGORIES: Category[] = ["sport", "study", "leisure"];

export const todayKey = () => new Date().toLocaleDateString("en-CA");

export const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const motivational = [
  "Маленький шаг сегодня — большой результат завтра.",
  "Ты ближе к цели, чем был утром.",
  "Не обязательно идеально. Главное — продолжать.",
  "Одно упражнение сейчас лучше идеального плана потом.",
  "Дисциплина — это забота о себе.",
];

export const randomMotivation = () =>
  motivational[Math.floor(Math.random() * motivational.length)] ??
  motivational[0]!;

export function defaultData(): AppData {
  return {
    date: todayKey(),
    notifications: true,
    history: [],
    tasks: [
      {
        id: uid(),
        category: "sport",
        title: "Отжимания",
        detail: "30 повторений",
        isCompleted: false,
        reminderTime: "18:00",
      },
      {
        id: uid(),
        category: "sport",
        title: "Пробежка",
        detail: "20 минут",
        isCompleted: false,
        reminderTime: "07:30",
      },
      {
        id: uid(),
        category: "study",
        title: "Почитать книгу",
        detail: "20 страниц",
        isCompleted: false,
        reminderTime: "17:00",
      },
      {
        id: uid(),
        category: "leisure",
        title: "Телефон",
        detail: "Лимит 2 часа",
        durationSeconds: 7200,
        remainingSeconds: 7200,
        endAt: null,
        isRunning: false,
        isCompleted: false,
      },
      {
        id: uid(),
        category: "leisure",
        title: "Телевизор",
        detail: "Лимит 1 час",
        durationSeconds: 3600,
        remainingSeconds: 3600,
        endAt: null,
        isRunning: false,
        isCompleted: false,
      },
    ],
  };
}

/** Repairs data loaded from storage so an old or broken payload cannot crash the app. */
export function normalize(raw: unknown): AppData {
  const fallback = defaultData();
  if (!raw || typeof raw !== "object") return fallback;
  const value = raw as Partial<AppData>;
  const tasks = Array.isArray(value.tasks) ? value.tasks : [];
  return {
    date: typeof value.date === "string" ? value.date : fallback.date,
    notifications: value.notifications !== false,
    history: Array.isArray(value.history)
      ? (value.history.filter(
          (day) => day && typeof day.date === "string",
        ) as AppData["history"])
      : [],
    tasks: tasks
      .filter(
        (task): task is Task =>
          !!task &&
          typeof task.title === "string" &&
          CATEGORIES.includes(task.category),
      )
      .map((task) => ({
        ...task,
        id: task.id || uid(),
        detail: task.detail ?? "",
        isCompleted: !!task.isCompleted,
        isRunning: !!task.isRunning,
      })),
  };
}

/** Seconds left on a leisure task, derived from the timer end timestamp. */
export function secondsLeft(task: Task, now: number) {
  if (task.isCompleted) return 0;
  if (task.isRunning && task.endAt) {
    return Math.max(0, Math.ceil((task.endAt - now) / 1000));
  }
  return Math.max(0, task.remainingSeconds ?? task.durationSeconds ?? 0);
}

export function formatClock(totalSeconds: number) {
  const total = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

export function formatLimit(totalSeconds: number) {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `Лимит ${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `Лимит ${hours} ч ${rest} мин` : `Лимит ${hours} ч`;
}

/** Applies the daily reset: keeps templates, clears progress, stores history. */
export function rollOverIfNewDay(data: AppData): AppData {
  const today = todayKey();
  if (data.date === today) return data;

  const completed = data.tasks.filter((task) => task.isCompleted).length;
  const snapshot = {
    date: data.date,
    completed,
    total: data.tasks.length,
  };

  return {
    ...data,
    date: today,
    history:
      data.tasks.length > 0
        ? [snapshot, ...data.history].slice(0, 60)
        : data.history,
    tasks: data.tasks.map((task) => ({
      ...task,
      isCompleted: false,
      isRunning: false,
      endAt: null,
      timerId: undefined,
      remainingSeconds: task.durationSeconds ?? task.remainingSeconds,
    })),
  };
}

export function streakLength(data: AppData) {
  let streak = 0;
  for (const day of data.history) {
    if (day.total > 0 && day.completed === day.total) streak += 1;
    else break;
  }
  return streak;
}
