import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Audio } from "expo-av";
import { StatusBar } from "expo-status-bar";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Animated,
  AppState,
  Easing,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";

import {
  CATEGORIES,
  STORE_KEY,
  defaultData,
  formatClock,
  formatLimit,
  normalize,
  randomMotivation,
  rollOverIfNewDay,
  secondsLeft,
  todayKey,
  uid,
} from "./src/data";
import {
  AnimatedCheck,
  Confetti,
  FadeSlide,
  PopIn,
  ProgressBar,
  PulseDot,
  Spin,
  StrikeText,
  Tappable,
  useCountUp,
  useReducedMotion,
} from "./src/motion";
import {
  cancel,
  cancelAll,
  categoryTitle,
  ensurePermission,
  notifyNow,
  parseTime,
  rescheduleReminders,
  scheduleReminder,
  scheduleTimerEnd,
} from "./src/notify";
import { SettingsScreen, StatsScreen } from "./src/screens";
import { colors, gradient, radius, space } from "./src/theme";
import { AppData, Category, Tab, Task } from "./src/types";

// DayFlow is an Android-only app; LayoutAnimation needs this flag on Android.
if (UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const STATUS_BAR_HEIGHT = RNStatusBar.currentHeight ?? 24;

const meta: Record<
  Category,
  {
    icon: string;
    color: string;
    subtitle: string;
    gradient: readonly [string, string];
  }
> = {
  sport: {
    icon: "⚡",
    color: colors.violetSoft,
    subtitle: "Сила и здоровье",
    gradient: gradient.sport,
  },
  study: {
    icon: "📚",
    color: colors.blueSoft,
    subtitle: "Знания и развитие",
    gradient: gradient.study,
  },
  leisure: {
    icon: "◷",
    color: colors.cyan,
    subtitle: "Отдых под контролем",
    gradient: gradient.leisure,
  },
};

const TABS: Array<{ key: Tab; icon: string; label: string }> = [
  { key: "today", icon: "⌂", label: "Сегодня" },
  { key: "stats", icon: "▥", label: "Статистика" },
  { key: "settings", icon: "⚙", label: "Настройки" },
];

const gentleLayout = () =>
  LayoutAnimation.configureNext({
    duration: 260,
    create: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
    update: { type: LayoutAnimation.Types.easeInEaseOut },
    delete: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
  });

export default function App() {
  const [data, setData] = useState<AppData>(() => defaultData());
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("today");
  const [now, setNow] = useState(() => Date.now());
  const [sheet, setSheet] = useState<Category | null>(null);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [minutes, setMinutes] = useState("60");
  const [reminder, setReminder] = useState("18:00");
  const [celebration, setCelebration] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [userName, setUserName] = useState("");
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundsRef = useRef<Record<string, Audio.Sound>>({});
  const soundEnabledRef = useRef(true);

  const completedFlags = useRef<Record<string, boolean>>({});
  const initialised = useRef(false);

  /* ---------------------------------------------------------------- loading */

  useEffect(() => {
    let alive = true;
    (async () => {
      let loaded = defaultData();
      try {
        const raw = await AsyncStorage.getItem(STORE_KEY);
        if (raw) loaded = normalize(JSON.parse(raw));
      } catch {
        loaded = defaultData();
      }
      const rolled = rollOverIfNewDay(loaded);
      const storedName = await AsyncStorage.getItem('dayflow_name');
      if (!alive) return;
      setData(rolled);
      if (!storedName) {
        setShowNamePrompt(true);
      } else {
        setUserName(storedName);
      }
      setReady(true);
      if (rolled.notifications) {
        const granted = await ensurePermission();
        if (!alive) return;
        setPermissionDenied(!granted);
        if (granted) {
          const tasks = await rescheduleReminders(rolled.tasks);
          if (alive) setData((prev) => ({ ...prev, tasks }));
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(STORE_KEY, JSON.stringify(data)).catch(() => {});
  }, [data, ready]);

  /* ------------------------------------------------------------ live ticker */

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const interval = setInterval(tick, 1000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") tick();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, []);

  // Finish expired timers and roll the day over without writing every second.
  useEffect(() => {
    if (!ready) return;
    setData((prev) => {
      const rolled = rollOverIfNewDay(prev);
      let changed = rolled !== prev;
      const tasks = rolled.tasks.map((task) => {
        if (!task.isRunning || !task.endAt || task.isCompleted) return task;
        if (task.endAt > now) return task;
        changed = true;
        return {
          ...task,
          isRunning: false,
          endAt: null,
          remainingSeconds: 0,
          isCompleted: true,
          timerId: undefined,
        };
      });
      return changed ? { ...rolled, tasks } : prev;
    });
  }, [now, ready]);

  /* ------------------------------------------------------- derived progress */

  const sections = useMemo(
    () =>
      CATEGORIES.map((category) => {
        const tasks = data.tasks.filter((task) => task.category === category);
        const done = tasks.filter((task) => task.isCompleted).length;
        return {
          category,
          tasks,
          done,
          percent: tasks.length ? (done / tasks.length) * 100 : 0,
        };
      }),
    [data.tasks],
  );

  const total = data.tasks.length;
  const completed = data.tasks.filter((task) => task.isCompleted).length;
  const progress = total ? Math.round((completed / total) * 100) : 0;
  const animatedPercent = useCountUp(progress);

  const leisureUsed = useMemo(
    () =>
      data.tasks
        .filter((task) => task.category === "leisure")
        .reduce((sum, task) => {
          const limit = task.durationSeconds ?? 0;
          return sum + Math.max(0, limit - secondsLeft(task, now));
        }, 0),
    [data.tasks, now],
  );

  /* --------------------------------------------------- celebration tracking */

  useEffect(() => {
    if (!ready) return;
    const flags: Record<string, boolean> = {};
    for (const category of CATEGORIES) {
      const tasks = data.tasks.filter((task) => task.category === category);
      flags[category] = tasks.length > 0 && tasks.every((t) => t.isCompleted);
    }
    flags.all = total > 0 && completed === total;

    if (!initialised.current) {
      completedFlags.current = flags;
      initialised.current = true;
      return;
    }

    for (const key of [...CATEGORIES, "all"] as string[]) {
      if (flags[key] && !completedFlags.current[key]) {
        const message =
          key === "all"
            ? "Весь план на сегодня выполнен!"
            : `Раздел «${categoryTitle[key as Category]}» выполнен!`;
        setCelebration(message);
        void playSound("celebrate");
        if (data.notifications) {
          notifyNow(
            key === "all" ? "День завершён" : "Отличная работа!",
            key === "all"
              ? "Ты выполнил весь план на сегодня. Так держать!"
              : message,
          ).catch(() => {});
        }
        break;
      }
    }
    completedFlags.current = flags;
  }, [completed, data.notifications, data.tasks, ready, total]);

  /* ----------------------------------------------------------------- actions */

  const toggleTask = useCallback((task: Task) => {
    if (task.category === "leisure") return;
    if (!task.isCompleted) void playSound("complete");
    gentleLayout();
    setData((prev) => ({
      ...prev,
      tasks: prev.tasks.map((item) =>
        item.id === task.id
          ? { ...item, isCompleted: !item.isCompleted }
          : item,
      ),
    }));
  }, []);

  const toggleTimer = useCallback(
    async (task: Task) => {
      if (task.isCompleted) return;
      const running = data.tasks.find((item) => item.isRunning);
      if (!task.isRunning && running && running.id !== task.id) {
        Alert.alert(
          "Таймер уже идёт",
          `Сначала поставь на паузу: ${running.title}.`,
        );
        return;
      }

      if (task.isRunning) {
        await cancel(task.timerId);
        const left = secondsLeft(task, Date.now());
        setData((prev) => ({
          ...prev,
          tasks: prev.tasks.map((item) =>
            item.id === task.id
              ? {
                  ...item,
                  isRunning: false,
                  endAt: null,
                  remainingSeconds: left,
                  timerId: undefined,
                }
              : item,
          ),
        }));
        return;
      }

      const seconds = Math.max(1, secondsLeft(task, Date.now()));
      let timerId: string | undefined;
      if (data.notifications) {
        try {
          timerId = await scheduleTimerEnd(task, seconds);
        } catch {
          timerId = undefined;
        }
      }
      setData((prev) => ({
        ...prev,
        tasks: prev.tasks.map((item) =>
          item.id === task.id
            ? {
                ...item,
                isRunning: true,
                endAt: Date.now() + seconds * 1000,
                remainingSeconds: seconds,
                timerId,
              }
            : item,
        ),
      }));
    },
    [data.notifications, data.tasks],
  );

  const finishTimer = useCallback(async (task: Task) => {
    await cancel(task.timerId);
    void playSound("timer");
    gentleLayout();
    setData((prev) => ({
      ...prev,
      tasks: prev.tasks.map((item) =>
        item.id === task.id
          ? {
              ...item,
              isRunning: false,
              endAt: null,
              remainingSeconds: 0,
              isCompleted: true,
              timerId: undefined,
            }
          : item,
      ),
    }));
  }, []);

  const resetTimer = useCallback(async (task: Task) => {
    await cancel(task.timerId);
    gentleLayout();
    setData((prev) => ({
      ...prev,
      tasks: prev.tasks.map((item) =>
        item.id === task.id
          ? {
              ...item,
              isRunning: false,
              endAt: null,
              isCompleted: false,
              remainingSeconds: item.durationSeconds ?? item.remainingSeconds,
              timerId: undefined,
            }
          : item,
      ),
    }));
  }, []);

  const openSheet = (category: Category) => {
    setEditTaskId(null);
    setSheet(category);
    setTitle("");
    setDetail("");
    setMinutes(category === "leisure" ? "60" : "30");
    setReminder(category === "sport" ? "18:00" : "17:00");
  };

  const addTask = async () => {
    if (!sheet) return;
    const name = title.trim();
    if (!name) {
      Alert.alert("Добавь название", "Например: Приседания или Английский.");
      return;
    }

    if (editTaskId) {
      const duration = Math.round(Number(minutes.replace(",", ".")) * 60);
      gentleLayout();
      setData((prev) => ({
        ...prev,
        tasks: prev.tasks.map((item) =>
          item.id === editTaskId
            ? {
                ...item,
                title: name,
                detail:
                  detail.trim() ||
                  (item.category === "leisure"
                    ? formatLimit(duration)
                    : "Задача на сегодня"),
                ...(item.category === "leisure"
                  ? {
                      durationSeconds: duration,
                      remainingSeconds: item.isRunning
                        ? item.remainingSeconds
                        : duration,
                    }
                  : { reminderTime: reminder.trim() }),
              }
            : item,
        ),
      }));
      setEditTaskId(null);
      setSheet(null);
      return;
    }

    if (sheet === "leisure") {
      const value = Number(minutes.replace(",", "."));
      if (!Number.isFinite(value) || value <= 0 || value > 24 * 60) {
        Alert.alert("Проверь лимит", "Укажи время в минутах от 1 до 1440.");
        return;
      }
    } else if (!parseTime(reminder)) {
      Alert.alert(
        "Проверь время",
        "Формат напоминания: ЧЧ:ММ, например 07:30.",
      );
      return;
    }

    const duration = Math.round(Number(minutes.replace(",", ".")) * 60);
    const task: Task = {
      id: uid(),
      category: sheet,
      title: name,
      detail:
        detail.trim() ||
        (sheet === "leisure" ? formatLimit(duration) : "Задача на сегодня"),
      isCompleted: false,
      ...(sheet === "leisure"
        ? {
            durationSeconds: duration,
            remainingSeconds: duration,
            endAt: null,
            isRunning: false,
          }
        : { reminderTime: reminder.trim() }),
    };

    if (sheet !== "leisure" && data.notifications) {
      try {
        task.reminderId = await scheduleReminder(task);
      } catch {
        task.reminderId = undefined;
      }
    }

    gentleLayout();
    setData((prev) => ({ ...prev, tasks: [...prev.tasks, task] }));
    setSheet(null);
  };

  const removeTask = (task: Task) => {
    Alert.alert(`Удалить «${task.title}»?`, "Это действие нельзя отменить.", [
      { text: "Отмена", style: "cancel" },
      {
        text: "Удалить",
        style: "destructive",
        onPress: async () => {
          await cancel(task.reminderId);
          await cancel(task.timerId);
          gentleLayout();
          setData((prev) => ({
            ...prev,
            tasks: prev.tasks.filter((item) => item.id !== task.id),
          }));
        },
      },
    ]);
  };

  const taskOptions = (task: Task) => {
    Alert.alert(task.title, "Что хочешь сделать?", [
      { text: "Отмена", style: "cancel" },
      {
        text: "✏️ Внести правку",
        onPress: () => {
          setEditTaskId(task.id);
          setSheet(task.category);
          setTitle(task.title);
          setDetail(task.detail || "");
          if (task.category === "leisure") {
            setMinutes(String(Math.round((task.durationSeconds ?? 3600) / 60)));
          } else {
            setReminder(task.reminderTime || "18:00");
          }
        },
      },
      {
        text: "🗑 Удалить",
        style: "destructive",
        onPress: () => removeTask(task),
      },
    ]);
  };

  const setNotifications = async (value: boolean) => {
    if (value) {
      const granted = await ensurePermission();
      setPermissionDenied(!granted);
      if (!granted) return;
      const tasks = await rescheduleReminders(data.tasks);
      setData((prev) => ({ ...prev, notifications: true, tasks }));
      return;
    }
    await cancelAll();
    setData((prev) => ({
      ...prev,
      notifications: false,
      tasks: prev.tasks.map((task) => ({
        ...task,
        reminderId: undefined,
        timerId: undefined,
      })),
    }));
  };

  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('dayflow_sound');
        if (!alive) return;
        const enabled = stored !== 'false';
        setSoundEnabled(enabled);
        soundEnabledRef.current = enabled;
        const [c, cel, t] = await Promise.all([
          Audio.Sound.createAsync(require('./sound-complete.mp3'), { shouldPlay: false, volume: 0.7 }),
          Audio.Sound.createAsync(require('./sound-celebrate.mp3'), { shouldPlay: false, volume: 0.8 }),
          Audio.Sound.createAsync(require('./sound-timer.mp3'), { shouldPlay: false, volume: 0.7 }),
        ]);
        if (!alive) return;
        soundsRef.current = { complete: c.sound, celebrate: cel.sound, timer: t.sound };
      } catch {
        // sounds not critical
      }
    })();
    return () => {
      alive = false;
      Object.values(soundsRef.current).forEach((s) => s.unloadAsync().catch(() => {}));
    };
  }, []);

  const playSound = async (key: "complete" | "celebrate" | "timer") => {
    if (!soundEnabledRef.current) return;
    const sound = soundsRef.current[key];
    if (!sound) return;
    try { await sound.setPositionAsync(0); await sound.playAsync(); } catch {}
  };

  const toggleSound = async (value: boolean) => {
    setSoundEnabled(value);
    soundEnabledRef.current = value;
    await AsyncStorage.setItem('dayflow_sound', value ? 'true' : 'false');
  };

  const resetAll = () => {
    Alert.alert("Сбросить данные?", "Все задачи и история будут удалены.", [
      { text: "Отмена", style: "cancel" },
      {
        text: "Сбросить",
        style: "destructive",
        onPress: async () => {
          await cancelAll();
          initialised.current = false;
          gentleLayout();
          setData({
            date: todayKey(),
            tasks: [],
            history: [],
            notifications: data.notifications,
          });
        },
      },
    ]);
  };

  /* ------------------------------------------------------------------- view */

  if (!ready) return <SplashScreen />;

  return (
    <LinearGradient colors={gradient.screen} style={styles.flex}>
      <StatusBar style="light" />
      <AmbientGlow />
      <SafeAreaView style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.screen}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {tab === "today" && (
            <View key="today">
              <FadeSlide>
                <View style={styles.header}>
                  <View style={styles.flexShrink}>
                    <Text style={styles.eyebrow}>ТВОЙ ДЕНЬ</Text>
                    <Text style={styles.heading}>{`Привет${userName ? \`, ${userName}\` : ''}!`}</Text>
                    <Text style={styles.date}>
                      {new Date().toLocaleDateString("ru-RU", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </Text>
                  </View>
                  <View style={styles.avatar}>
                    <Spin duration={14000}>
                      <Text style={styles.avatarText}>✦</Text>
                    </Spin>
                  </View>
                </View>
              </FadeSlide>

              <FadeSlide delay={60}>
                <LinearGradient
                  colors={gradient.accent}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.hero}
                >
                  <View style={styles.heroTop}>
                    <View>
                      <Text style={styles.heroLabel}>ПРОГРЕСС ДНЯ</Text>
                      <Text style={styles.heroValue}>{animatedPercent}%</Text>
                    </View>
                    <View style={styles.heroBadge}>
                      <Text style={styles.heroBadgeText}>
                        {completed}/{total}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.heroBar}>
                    <ProgressBar value={progress} />
                  </View>
                  <View style={styles.heroChips}>
                    {sections.map((section) => (
                      <View key={section.category} style={styles.chip}>
                        <Text style={styles.chipText}>
                          {meta[section.category].icon} {section.done}/
                          {section.tasks.length}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <Text style={styles.heroCopy}>
                    {progress === 100 && total > 0
                      ? "Идеальный день — всё выполнено!"
                      : "Каждый зачёркнутый пункт делает день лучше."}
                  </Text>
                </LinearGradient>
              </FadeSlide>

              <FadeSlide delay={110}>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>План на сегодня</Text>
                  <Text style={styles.sectionHint}>удержание — правка / удалить</Text>
                </View>
              </FadeSlide>

              {sections.map((section, index) => (
                <FadeSlide
                  key={section.category}
                  delay={150 + index * 70}
                  style={styles.cardWrap}
                >
                  <View style={styles.card}>
                    <View style={styles.cardHead}>
                      <LinearGradient
                        colors={meta[section.category].gradient}
                        style={styles.iconBox}
                      >
                        <Text style={styles.iconText}>
                          {meta[section.category].icon}
                        </Text>
                      </LinearGradient>
                      <View style={styles.cardInfo}>
                        <Text style={styles.cardTitle}>
                          {categoryTitle[section.category]}
                        </Text>
                        <Text style={styles.cardSubtitle}>
                          {section.done} из {section.tasks.length} ·{" "}
                          {meta[section.category].subtitle}
                        </Text>
                      </View>
                      <Tappable
                        accessibilityLabel={`Добавить в ${categoryTitle[section.category]}`}
                        style={styles.addButton}
                        onPress={() => openSheet(section.category)}
                        scaleTo={0.88}
                      >
                        <Text style={styles.addText}>＋</Text>
                      </Tappable>
                    </View>

                    <View style={styles.cardProgress}>
                      <ProgressBar
                        value={section.percent}
                        color={meta[section.category].color}
                        track={colors.border}
                        height={5}
                      />
                    </View>

                    {section.tasks.length === 0 ? (
                      <Text style={styles.empty}>
                        Пока пусто — добавь первое занятие.
                      </Text>
                    ) : (
                      section.tasks.map((task) =>
                        section.category === "leisure" ? (
                          <LeisureRow
                            key={task.id}
                            task={task}
                            now={now}
                            onToggle={() => toggleTimer(task)}
                            onFinish={() => finishTimer(task)}
                            onReset={() => resetTimer(task)}
                            onLongPress={() => taskOptions(task)}
                          />
                        ) : (
                          <TaskRow
                            key={task.id}
                            task={task}
                            color={meta[section.category].color}
                            onPress={() => toggleTask(task)}
                            onLongPress={() => taskOptions(task)}
                          />
                        ),
                      )
                    )}
                  </View>
                </FadeSlide>
              ))}

              {total > 0 && progress < 100 && (
                <FadeSlide delay={400}>
                  <Tappable
                    style={styles.motivation}
                    onPress={() => {
                      const text = randomMotivation();
                      if (data.notifications) {
                        notifyNow("Ты справишься!", text).catch(() => {});
                      }
                      Alert.alert("DayFlow", text);
                    }}
                  >
                    <Spin duration={11000}>
                      <Text style={styles.motivationIcon}>✦</Text>
                    </Spin>
                    <View style={styles.flexShrink}>
                      <Text style={styles.motivationTitle}>Нужен импульс?</Text>
                      <Text style={styles.motivationCopy}>
                        Нажми — DayFlow пришлёт мотивацию
                      </Text>
                    </View>
                  </Tappable>
                </FadeSlide>
              )}

              {total === 0 && (
                <FadeSlide delay={220}>
                  <View style={styles.emptyDay}>
                    <Text style={styles.emptyDayIcon}>◌</Text>
                    <Text style={styles.emptyDayTitle}>План пуст</Text>
                    <Text style={styles.emptyDayCopy}>
                      Добавь упражнение, учебную задачу или лимит отдыха, чтобы
                      начать день.
                    </Text>
                  </View>
                </FadeSlide>
              )}
            </View>
          )}

          {tab === "stats" && (
            <StatsScreen
              key="stats"
              data={data}
              progress={progress}
              leisureUsed={leisureUsed}
            />
          )}

          {tab === "settings" && (
            <View key="settings">
              <FadeSlide>
                <View style={styles.soundCard}>
                  <View style={styles.soundCardLeft}>
                    <Text style={styles.soundCardIcon}>{soundEnabled ? "🔊" : "🔇"}</Text>
                    <View>
                      <Text style={styles.soundCardTitle}>Звуки</Text>
                      <Text style={styles.soundCardSub}>{soundEnabled ? "Включены" : "Выключены"}</Text>
                    </View>
                  </View>
                  <Tappable style={[styles.soundToggle, soundEnabled && styles.soundToggleOn]} onPress={() => toggleSound(!soundEnabled)} scaleTo={0.92}>
                    <Text style={styles.soundToggleText}>{soundEnabled ? "ВКЛ" : "ВЫКЛ"}</Text>
                  </Tappable>
                </View>
              </FadeSlide>
              <SettingsScreen
                key="settings"
              data={data}
              permissionDenied={permissionDenied}
              onToggleNotifications={setNotifications}
              onReset={resetAll}
              onTestNotification={() =>
                notifyNow("Проверка", "Уведомления от DayFlow работают.").catch(
                  () => {},
                )
              }
            />
            </View>
          )}
        </ScrollView>

        <TabBar active={tab} onChange={setTab} />
      </SafeAreaView>

      <AddSheet
        category={sheet}
        title={title}
        detail={detail}
        minutes={minutes}
        reminder={reminder}
        onTitle={setTitle}
        onDetail={setDetail}
        onMinutes={setMinutes}
        onReminder={setReminder}
        onClose={() => { setEditTaskId(null); setSheet(null); }}
        onSubmit={addTask}
        isEditMode={!!editTaskId}
      />

      <CelebrationModal
        message={celebration}
        onClose={() => setCelebration(null)}
      />
      <NamePromptModal
        visible={showNamePrompt}
        nameInput={nameInput}
        onChangeText={setNameInput}
        onSubmit={async () => {
          const name = nameInput.trim() || 'Ты';
          await AsyncStorage.setItem('dayflow_name', name);
          setUserName(name);
          setShowNamePrompt(false);
        }}
      />
    </LinearGradient>
  );
}

/* ------------------------------------------------------------- subcomponents */

function SplashScreen() {
  const anim = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      anim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0.35,
          duration: 800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, reduced]);

  return (
    <LinearGradient colors={gradient.screen} style={styles.center}>
      <Animated.Text style={[styles.splash, { opacity: anim }]}>
        DayFlow
      </Animated.Text>
    </LinearGradient>
  );
}

/** Slow floating background blobs so the screen never looks frozen. */
function AmbientGlow() {
  const anim = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 9000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 9000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, reduced]);

  const drift = (from: number, to: number) =>
    anim.interpolate({ inputRange: [0, 1], outputRange: [from, to] });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.glow,
          styles.glowViolet,
          { transform: [{ translateY: drift(-20, 30) }, { scale: 1 }] },
        ]}
      />
      <Animated.View
        style={[
          styles.glow,
          styles.glowBlue,
          { transform: [{ translateY: drift(25, -25) }] },
        ]}
      />
    </View>
  );
}

function TaskRow({
  task,
  color,
  onPress,
  onLongPress,
}: {
  task: Task;
  color: string;
  onPress: () => void;
  onLongPress: () => void;
}) {
  return (
    <Tappable
      style={styles.row}
      onPress={onPress}
      onLongPress={onLongPress}
      scaleTo={0.985}
      accessibilityLabel={`${task.title}. ${task.isCompleted ? "Выполнено" : "Не выполнено"}`}
    >
      <AnimatedCheck checked={task.isCompleted} color={color} />
      <View style={styles.rowBody}>
        <StrikeText
          text={task.title}
          done={task.isCompleted}
          style={styles.rowTitle}
        />
        <Text style={styles.rowDetail}>
          {task.detail}
          {task.reminderTime ? ` · в ${task.reminderTime}` : ""}
        </Text>
      </View>
    </Tappable>
  );
}

function LeisureRow({
  task,
  now,
  onToggle,
  onFinish,
  onReset,
  onLongPress,
}: {
  task: Task;
  now: number;
  onToggle: () => void;
  onFinish: () => void;
  onReset: () => void;
  onLongPress: () => void;
}) {
  const left = secondsLeft(task, now);
  const limit = task.durationSeconds ?? left ?? 1;
  const used = Math.max(0, limit - left);
  const percent = limit ? (used / limit) * 100 : 0;

  return (
    <Pressable onLongPress={onLongPress} style={styles.leisureRow}>
      <View style={styles.leisureTop}>
        <PulseDot active={!!task.isRunning} color={colors.cyan} />
        <View style={styles.leisureBody}>
          <StrikeText
            text={task.title}
            done={task.isCompleted}
            style={styles.rowTitle}
          />
          <Text style={styles.rowDetail}>
            {task.isCompleted
              ? "Лимит исчерпан"
              : `Осталось ${formatClock(left)} · ${formatLimit(limit)}`}
          </Text>
        </View>
        {task.isCompleted ? (
          <Tappable
            style={styles.smallGhost}
            onPress={onReset}
            accessibilityLabel="Сбросить таймер"
          >
            <Text style={styles.smallGhostText}>↺</Text>
          </Tappable>
        ) : (
          <View style={styles.leisureActions}>
            <Tappable
              style={styles.playButton}
              onPress={onToggle}
              scaleTo={0.9}
              accessibilityLabel={task.isRunning ? "Пауза" : "Начать"}
            >
              <Text style={styles.playText}>{task.isRunning ? "‖" : "▶"}</Text>
            </Tappable>
            <Tappable
              style={styles.smallGhost}
              onPress={onFinish}
              scaleTo={0.9}
              accessibilityLabel="Завершить"
            >
              <Text style={styles.finishText}>✓</Text>
            </Tappable>
          </View>
        )}
      </View>
      <View style={styles.leisureBar}>
        <ProgressBar
          value={percent}
          color={task.isCompleted ? colors.green : colors.cyan}
          track={colors.border}
          height={5}
        />
      </View>
    </Pressable>
  );
}

function TabBar({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (tab: Tab) => void;
}) {
  const [width, setWidth] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  const index = TABS.findIndex((item) => item.key === active);

  useEffect(() => {
    Animated.spring(anim, {
      toValue: index,
      friction: 9,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [anim, index]);

  const itemWidth = width / TABS.length;

  return (
    <View
      style={styles.tabBar}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width - 16)}
    >
      {width > 0 && (
        <Animated.View
          style={[
            styles.tabIndicator,
            {
              width: itemWidth,
              transform: [
                {
                  translateX: reduced
                    ? itemWidth * index
                    : anim.interpolate({
                        inputRange: [0, TABS.length - 1],
                        outputRange: [0, itemWidth * (TABS.length - 1)],
                      }),
                },
              ],
            },
          ]}
        />
      )}
      {TABS.map((item) => {
        const isActive = item.key === active;
        return (
          <Tappable
            key={item.key}
            style={styles.tabItem}
            onPress={() => onChange(item.key)}
            scaleTo={0.92}
            accessibilityLabel={item.label}
          >
            <Text style={[styles.tabIcon, isActive && styles.tabActive]}>
              {item.icon}
            </Text>
            <Text style={[styles.tabLabel, isActive && styles.tabActive]}>
              {item.label}
            </Text>
          </Tappable>
        );
      })}
    </View>
  );
}

function AddSheet({
  category,
  title,
  detail,
  minutes,
  reminder,
  onTitle,
  onDetail,
  onMinutes,
  onReminder,
  onClose,
  onSubmit,
  isEditMode,
}: {
  category: Category | null;
  title: string;
  detail: string;
  minutes: string;
  reminder: string;
  onTitle: (value: string) => void;
  onDetail: (value: string) => void;
  onMinutes: (value: string) => void;
  onReminder: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  isEditMode?: boolean;
}) {
  const isLeisure = category === "leisure";
  const presets = isLeisure ? [15, 30, 60, 120] : [];

  return (
    <Modal
      visible={!!category}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView behavior="height" style={styles.sheetWrap}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle}>
            {category ? `Добавить · ${categoryTitle[category]}` : ""}
          </Text>

          <Text style={styles.label}>Название</Text>
          <TextInput
            value={title}
            onChangeText={onTitle}
            placeholder={isLeisure ? "Телевизор" : "Приседания"}
            placeholderTextColor="#73758A"
            style={styles.input}
            returnKeyType="next"
          />

          <Text style={styles.label}>
            {isLeisure ? "Описание" : "Норматив или объём"}
          </Text>
          <TextInput
            value={detail}
            onChangeText={onDetail}
            placeholder={isLeisure ? "Вечерний отдых" : "3 подхода по 15"}
            placeholderTextColor="#73758A"
            style={styles.input}
          />

          {isLeisure ? (
            <>
              <Text style={styles.label}>Лимит, минут</Text>
              <TextInput
                value={minutes}
                onChangeText={onMinutes}
                keyboardType="number-pad"
                style={styles.input}
              />
              <View style={styles.presets}>
                {presets.map((preset) => (
                  <Tappable
                    key={preset}
                    style={styles.preset}
                    onPress={() => onMinutes(String(preset))}
                    scaleTo={0.9}
                  >
                    <Text style={styles.presetText}>
                      {preset >= 60 ? `${preset / 60} ч` : `${preset} м`}
                    </Text>
                  </Tappable>
                ))}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.label}>Напоминание от DayFlow (ЧЧ:ММ)</Text>
              <TextInput
                value={reminder}
                onChangeText={onReminder}
                placeholder="18:00"
                placeholderTextColor="#73758A"
                keyboardType="numbers-and-punctuation"
                style={styles.input}
              />
            </>
          )}

          <Tappable onPress={onSubmit} scaleTo={0.97}>
            <LinearGradient
              colors={gradient.accent}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primary}
            >
              <Text style={styles.primaryText}>{isEditMode ? "Сохранить" : "Добавить в план"}</Text>
            </LinearGradient>
          </Tappable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function CelebrationModal({
  message,
  onClose,
}: {
  message: string | null;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={!!message}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.celebrateWrap}>
        <Confetti />
        <PopIn visible={!!message} style={styles.celebrateCard}>
          <LinearGradient
            colors={gradient.accent}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.celebrateInner}
          >
            <Spin duration={7000}>
              <Text style={styles.celebrateSpark}>✦</Text>
            </Spin>
            <Text style={styles.celebrateEmoji}>🏆</Text>
            <Text style={styles.celebrateTitle}>Отличная работа!</Text>
            <Text style={styles.celebrateCopy}>{message}</Text>
            <Tappable style={styles.celebrateButton} onPress={onClose}>
              <Text style={styles.celebrateButtonText}>Продолжить</Text>
            </Tappable>
          </LinearGradient>
        </PopIn>
      </View>
    </Modal>
  );
}


function NamePromptModal({
  visible,
  nameInput,
  onChangeText,
  onSubmit,
}: {
  visible: boolean;
  nameInput: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.nameModalOverlay}>
        <KeyboardAvoidingView behavior="padding">
          <View style={styles.nameModalCard}>
            <Text style={styles.nameModalTitle}>👋 Как тебя зовут?</Text>
            <Text style={styles.nameModalSub}>
              DayFlow будет приветствовать тебя по имени
            </Text>
            <TextInput
              value={nameInput}
              onChangeText={onChangeText}
              placeholder="Введи своё имя"
              placeholderTextColor="#73758A"
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={onSubmit}
              autoFocus
            />
            <Tappable onPress={onSubmit} scaleTo={0.97}>
              <LinearGradient
                colors={gradient.accent}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primary}
              >
                <Text style={styles.primaryText}>Начать</Text>
              </LinearGradient>
            </Tappable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/* -------------------------------------------------------------------- styles */

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  splash: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1,
  },
  glow: { position: "absolute", borderRadius: 400 },
  glowViolet: {
    width: 340,
    height: 340,
    top: -120,
    right: -110,
    backgroundColor: "rgba(124, 58, 237, 0.24)",
  },
  glowBlue: {
    width: 300,
    height: 300,
    bottom: 40,
    left: -130,
    backgroundColor: "rgba(37, 99, 235, 0.20)",
  },
  screen: {
    paddingHorizontal: 20,
    paddingTop: STATUS_BAR_HEIGHT + 16,
    paddingBottom: 130,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.xl,
  },
  eyebrow: {
    color: "#8C82C8",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.6,
    marginBottom: 6,
  },
  heading: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  date: {
    color: colors.textDim,
    fontSize: 14,
    marginTop: 5,
    textTransform: "capitalize",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: "rgba(124, 58, 237, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.violetSoft, fontSize: 20, fontWeight: "800" },
  hero: {
    borderRadius: radius.xl,
    padding: space.xl,
    marginBottom: space.xl,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroLabel: {
    color: "#E4DBFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  heroValue: {
    color: "#FFFFFF",
    fontSize: 44,
    fontWeight: "900",
    marginTop: 4,
  },
  heroBadge: {
    minWidth: 54,
    height: 54,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroBadgeText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
  heroBar: { marginTop: space.lg },
  heroChips: {
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.lg,
  },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  chipText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  heroCopy: {
    color: "#F1ECFF",
    fontSize: 13,
    lineHeight: 19,
    marginTop: space.md,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.md,
  },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: "800" },
  sectionHint: { color: colors.textFaint, fontSize: 12 },
  cardWrap: { marginBottom: space.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
  },
  cardHead: { flexDirection: "row", alignItems: "center" },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { fontSize: 21, color: "#FFFFFF", fontWeight: "800" },
  cardInfo: { flex: 1, marginLeft: space.md },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  cardSubtitle: { color: colors.textDim, fontSize: 12, marginTop: 3 },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(124, 58, 237, 0.16)",
  },
  addText: { color: colors.violetSoft, fontSize: 22, fontWeight: "700" },
  cardProgress: { marginTop: space.md },
  empty: { color: colors.textFaint, fontSize: 13, paddingTop: space.md },
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    marginTop: space.md,
    paddingTop: space.md,
  },
  rowBody: { flex: 1, marginLeft: space.md },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  rowDetail: { color: colors.textDim, fontSize: 12, marginTop: 4 },
  leisureRow: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    marginTop: space.md,
    paddingTop: space.md,
  },
  leisureTop: { flexDirection: "row", alignItems: "center" },
  leisureBody: { flex: 1, marginLeft: space.md },
  leisureActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  leisureBar: { marginTop: space.md, marginBottom: 2 },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: "rgba(34, 211, 238, 0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  playText: { color: colors.cyan, fontSize: 15, fontWeight: "900" },
  smallGhost: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  smallGhostText: { color: colors.textDim, fontSize: 17, fontWeight: "800" },
  finishText: { color: colors.green, fontSize: 17, fontWeight: "900" },
  motivation: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(124, 58, 237, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.35)",
    borderRadius: radius.lg,
    padding: space.lg,
    marginTop: space.xs,
  },
  motivationIcon: { fontSize: 22, color: colors.violetSoft, marginRight: 14 },
  motivationTitle: { color: colors.text, fontWeight: "800", fontSize: 15 },
  motivationCopy: { color: colors.textDim, fontSize: 12, marginTop: 3 },
  emptyDay: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.xl,
  },
  emptyDayIcon: { color: "#6D5BB2", fontSize: 36 },
  emptyDayTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
    marginTop: space.md,
  },
  emptyDayCopy: {
    color: colors.textDim,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    textAlign: "center",
  },
  tabBar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 14,
    height: 74,
    borderRadius: 24,
    backgroundColor: "rgba(20, 22, 40, 0.95)",
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    padding: 8,
  },
  tabIndicator: {
    position: "absolute",
    top: 8,
    left: 8,
    bottom: 8,
    borderRadius: radius.md,
    backgroundColor: "rgba(124, 58, 237, 0.22)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.35)",
  },
  tabItem: {
    flex: 1,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIcon: { color: colors.textFaint, fontSize: 20 },
  tabLabel: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 3,
  },
  tabActive: { color: colors.violetSoft },
  sheetWrap: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5, 7, 17, 0.72)",
  },
  sheet: {
    backgroundColor: "#171A2C",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: space.xl,
    paddingBottom: space.xl + 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  grabber: {
    width: 44,
    height: 5,
    borderRadius: 4,
    backgroundColor: "#494B60",
    alignSelf: "center",
    marginBottom: space.lg,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "900",
    marginBottom: space.lg,
  },
  label: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 7,
  },
  input: {
    height: 50,
    borderRadius: radius.sm,
    backgroundColor: "#0F1120",
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 15,
    fontSize: 15,
    marginBottom: space.md,
  },
  presets: { flexDirection: "row", gap: space.sm, marginBottom: space.md },
  preset: {
    minWidth: 56,
    height: 44,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  presetText: { color: colors.textDim, fontSize: 13, fontWeight: "700" },
  primary: {
    height: 54,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: space.sm,
  },
  primaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  celebrateWrap: {
    flex: 1,
    backgroundColor: "rgba(7, 9, 18, 0.82)",
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
  },
  celebrateCard: { width: "100%", borderRadius: 28, overflow: "hidden" },
  celebrateInner: { padding: space.xl, alignItems: "center" },
  celebrateSpark: { color: "#FFFFFF", fontSize: 26, opacity: 0.9 },
  celebrateEmoji: { fontSize: 58, marginTop: space.md },
  celebrateTitle: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "900",
    marginTop: space.md,
  },
  celebrateCopy: {
    color: "#EFE9FF",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
    marginBottom: space.xl,
  },
  celebrateButton: {
    height: 52,
    alignSelf: "stretch",
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  celebrateButtonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 15 },
  soundCard: {
    backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.border, flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", padding: space.lg, marginBottom: space.md,
  },
  soundCardLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  soundCardIcon: { fontSize: 26 },
  soundCardTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  soundCardSub: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  soundToggle: {
    paddingHorizontal: 16, height: 36, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1,
    borderColor: colors.border, alignItems: "center", justifyContent: "center",
  },
  soundToggleOn: {
    backgroundColor: "rgba(124, 58, 237, 0.22)",
    borderColor: "rgba(167, 139, 250, 0.45)",
  },
  soundToggleText: { color: colors.violetSoft, fontSize: 12, fontWeight: "800" },
  nameModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(7,9,18,0.88)",
    justifyContent: "center",
    padding: 24,
  },
  nameModalCard: {
    backgroundColor: "#171A2C",
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nameModalTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 8,
  },
  nameModalSub: {
    color: colors.textDim,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
});
