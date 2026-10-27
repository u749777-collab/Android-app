import * as Notifications from "expo-notifications";

import { Category, Task } from "./types";

export const CHANNEL_ID = "dayflow";

export const categoryTitle: Record<Category, string> = {
  sport: "Спорт",
  study: "Учёба",
  leisure: "Свободное время",
};

// Безопасная установка обработчика — если модуль по какой-то причине
// не инициализировался, приложение продолжит работать без уведомлений.
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch {
  // ignore — notifications will not work, app still runs
}

export async function ensurePermission(): Promise<boolean> {
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "DayFlow напоминания",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: "#7C3AED",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      enableVibrate: true,
    });
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

export async function notifyNow(title: string, body: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `DayFlow · ${title}`,
        body,
        sound: "default",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
        channelId: CHANNEL_ID,
        repeats: false,
      },
    });
  } catch {
    // ignore
  }
}

export function parseTime(value?: string) {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

export async function scheduleReminder(task: Task) {
  if (task.category === "leisure") return undefined;
  const time = parseTime(task.reminderTime);
  if (!time) return undefined;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: `DayFlow · ${categoryTitle[task.category]}`,
        body: `Пора выполнить: ${task.title}`,
        sound: "default",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: time.hour,
        minute: time.minute,
        channelId: CHANNEL_ID,
      },
    });
  } catch {
    return undefined;
  }
}

export async function scheduleTimerEnd(task: Task, seconds: number) {
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: "DayFlow · Время закончилось",
        body: `${task.title}: лимит завершён. Пункт зачёркнут автоматически.`,
        sound: "default",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(seconds)),
        channelId: CHANNEL_ID,
        repeats: false,
      },
    });
  } catch {
    return undefined;
  }
}

export async function cancel(id?: string) {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {}
}

export async function cancelAll() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {}
}

export async function rescheduleReminders(tasks: Task[]): Promise<Task[]> {
  await cancelAll();
  const next: Task[] = [];
  for (const task of tasks) {
    if (task.category === "leisure") {
      next.push({ ...task, timerId: undefined });
      continue;
    }
    next.push({ ...task, reminderId: await scheduleReminder(task) });
  }
  return next;
}
