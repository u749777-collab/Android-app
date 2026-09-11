import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Switch, Text, View } from "react-native";

import { AppData } from "./types";
import { colors, gradient, radius, space } from "./theme";
import { formatClock, streakLength } from "./data";
import { FadeSlide, ProgressBar, Tappable, useCountUp } from "./motion";

/** Statistics tab: today's result, streak and the last days. */
export function StatsScreen({
  data,
  progress,
  leisureUsed,
}: {
  data: AppData;
  progress: number;
  leisureUsed: number;
}) {
  const percent = useCountUp(progress);
  const streak = streakLength(data);
  const week = data.history.slice(0, 7);

  return (
    <View>
      <FadeSlide>
        <Text style={styles.eyebrow}>ДИНАМИКА</Text>
        <Text style={styles.heading}>Статистика</Text>
      </FadeSlide>

      <FadeSlide delay={70}>
        <View style={styles.statRow}>
          <LinearGradient
            colors={gradient.accent}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.statCardAccent}
          >
            <Text style={styles.statLabelLight}>Сегодня</Text>
            <Text style={styles.statValueLight}>{percent}%</Text>
            <View style={{ marginTop: space.md }}>
              <ProgressBar value={progress} height={6} />
            </View>
          </LinearGradient>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Серия дней</Text>
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statHint}>подряд без пропусков</Text>
          </View>
        </View>
      </FadeSlide>

      <FadeSlide delay={140}>
        <View style={styles.leisureCard}>
          <Text style={styles.statLabel}>
            Использовано на развлечения сегодня
          </Text>
          <Text style={styles.leisureValue}>{formatClock(leisureUsed)}</Text>
        </View>
      </FadeSlide>

      <FadeSlide delay={210}>
        <Text style={styles.sectionTitle}>Последние дни</Text>
        {week.length === 0 ? (
          <View style={styles.blank}>
            <Text style={styles.blankIcon}>◌</Text>
            <Text style={styles.blankTitle}>История появится завтра</Text>
            <Text style={styles.blankCopy}>
              Заверши сегодняшний план — DayFlow сохранит результат при смене
              дня.
            </Text>
          </View>
        ) : (
          week.map((day, index) => (
            <FadeSlide key={day.date} delay={index * 60} offset={12}>
              <View style={styles.historyRow}>
                <Text style={styles.historyDate}>
                  {day.date.split("-").reverse().slice(0, 2).join(".")}
                </Text>
                <View style={styles.historyBar}>
                  <ProgressBar
                    value={day.total ? (day.completed / day.total) * 100 : 0}
                    color={colors.violetSoft}
                    track={colors.border}
                    height={6}
                  />
                </View>
                <Text style={styles.historyValue}>
                  {day.completed}/{day.total}
                </Text>
              </View>
            </FadeSlide>
          ))
        )}
      </FadeSlide>
    </View>
  );
}

/** Settings tab: notification switch, explanation and reset. */
export function SettingsScreen({
  data,
  onToggleNotifications,
  onReset,
  onTestNotification,
  permissionDenied,
}: {
  data: AppData;
  onToggleNotifications: (value: boolean) => void;
  onReset: () => void;
  onTestNotification: () => void;
  permissionDenied: boolean;
}) {
  return (
    <View>
      <FadeSlide>
        <Text style={styles.eyebrow}>ПРИЛОЖЕНИЕ</Text>
        <Text style={styles.heading}>Настройки</Text>
      </FadeSlide>

      <FadeSlide delay={70}>
        <View style={styles.settingCard}>
          <View style={styles.settingRow}>
            <View style={{ flex: 1, paddingRight: space.md }}>
              <Text style={styles.settingTitle}>Уведомления DayFlow</Text>
              <Text style={styles.settingCopy}>
                Напоминания, таймеры и поздравления приходят от приложения
              </Text>
            </View>
            <Switch
              value={data.notifications}
              onValueChange={onToggleNotifications}
              trackColor={{ false: "#34364A", true: "#6D4FE6" }}
              thumbColor="#FFFFFF"
            />
          </View>
          {permissionDenied && (
            <Text style={styles.warning}>
              Система заблокировала уведомления. Разреши их для DayFlow в
              настройках телефона.
            </Text>
          )}
        </View>
      </FadeSlide>

      <FadeSlide delay={140}>
        <Tappable style={styles.testButton} onPress={onTestNotification}>
          <Text style={styles.testText}>Проверить уведомление</Text>
        </Tappable>
      </FadeSlide>

      <FadeSlide delay={200}>
        <View style={styles.note}>
          <Text style={styles.noteTitle}>Как это работает</Text>
          <Text style={styles.noteCopy}>
            Все данные хранятся только на телефоне. В начале нового дня
            выполненные пункты и лимиты восстанавливаются автоматически, а
            результат прошлого дня уходит в статистику.
          </Text>
        </View>
      </FadeSlide>

      <FadeSlide delay={260}>
        <Tappable style={styles.danger} onPress={onReset}>
          <Text style={styles.dangerText}>Сбросить все данные</Text>
        </Tappable>
      </FadeSlide>
    </View>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: space.lg,
  },
  statRow: { flexDirection: "row", gap: space.md },
  statCardAccent: { flex: 1, borderRadius: radius.lg, padding: space.lg },
  statCard: {
    flex: 1,
    borderRadius: radius.lg,
    padding: space.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statLabel: { color: colors.textDim, fontSize: 12, fontWeight: "700" },
  statLabelLight: { color: "#E7DEFF", fontSize: 12, fontWeight: "800" },
  statValue: {
    color: colors.violetSoft,
    fontSize: 34,
    fontWeight: "900",
    marginTop: 6,
  },
  statValueLight: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    marginTop: 6,
  },
  statHint: { color: colors.textFaint, fontSize: 11, marginTop: 6 },
  leisureCard: {
    marginTop: space.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
  },
  leisureValue: {
    color: colors.cyan,
    fontSize: 26,
    fontWeight: "900",
    marginTop: 6,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "800",
    marginTop: space.xl,
    marginBottom: space.md,
  },
  blank: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.xl,
  },
  blankIcon: { color: "#6D5BB2", fontSize: 38 },
  blankTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    marginTop: space.md,
  },
  blankCopy: {
    color: colors.textDim,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    textAlign: "center",
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    marginBottom: space.sm,
  },
  historyDate: { color: colors.text, fontSize: 13, width: 56 },
  historyBar: { flex: 1, marginHorizontal: space.md },
  historyValue: {
    color: colors.textDim,
    fontSize: 12,
    width: 44,
    textAlign: "right",
  },
  settingCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settingTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  settingCopy: {
    color: colors.textDim,
    fontSize: 12,
    marginTop: 5,
    lineHeight: 17,
  },
  warning: { color: "#F5C57B", fontSize: 12, marginTop: space.md },
  testButton: {
    marginTop: space.md,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#3B3261",
    backgroundColor: "#201C38",
    alignItems: "center",
    justifyContent: "center",
  },
  testText: { color: "#C9BEFF", fontWeight: "800" },
  note: {
    backgroundColor: "#1A1C31",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    marginTop: space.md,
  },
  noteTitle: { color: "#C9BEFF", fontWeight: "800" },
  noteCopy: {
    color: colors.textDim,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  danger: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#653944",
    alignItems: "center",
    justifyContent: "center",
    marginTop: space.xl,
  },
  dangerText: { color: colors.red, fontWeight: "800" },
});
