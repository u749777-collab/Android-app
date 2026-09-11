import * as Notifications from "expo-notifications";

import { Category, Task } from "./types";

/** Android notification channel used for every DayFlow reminder. */
export const CHANNEL_ID = "dayflow";

export const categoryTitle: Record<Category, string> = {
  sport: "Спорт",
  study: "Учёба",
  leisure: "Свободное время",
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Creates the Android channel and asks for permission once. */
export async function ensurePermission(): Promise<boolean> {
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
}

/** Sends an instant notification from DayFlow. */
export async function notifyNow(title: string, body: string) {
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
}

/** Parses "HH:mm" and rejects impossible values such as 25:70. */
export function parseTime(value?: string) {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/** Schedules the daily repeating reminder for a sport or study task. */
export async function scheduleReminder(task: Task) {
  if (task.category === "leisure") return undefined;
  const time = parseTime(task.reminderTime);
  if (!time) return undefined;
  return Notifications.scheduleNotificationAsync({
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
}

/** Schedules the one-off notification fired when a leisure timer ends. */
export async function scheduleTimerEnd(task: Task, seconds: number) {
  return Notifications.scheduleNotificationAsync({
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
}

/** Safely cancels a scheduled notification id. */
export async function cancel(id?: string) {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Already delivered or removed by the system.
  }
}

export async function cancelAll() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/** Rebuilds every daily reminder, e.g. after notifications are re-enabled. */
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
