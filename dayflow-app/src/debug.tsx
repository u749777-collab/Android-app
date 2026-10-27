import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const LOG_KEY = "__dayflow_boot_v1";
const ERROR_KEY = "__dayflow_last_error_v1";
const MAX_LINES = 300;

let memoryLog: string[] = [];

/** Записать этап загрузки. Синхронно в память, асинхронно в AsyncStorage. */
export function bootLog(stage: string, data?: any) {
  const ts = new Date().toISOString().substring(11, 23);
  let extra = "";
  if (data !== undefined) {
    try {
      if (data instanceof Error) extra = ` :: ${data.message}`;
      else if (typeof data === "object") extra = ` :: ${JSON.stringify(data)}`;
      else extra = ` :: ${String(data)}`;
    } catch {
      extra = " :: <unserializable>";
    }
  }
  const line = `[${ts}] ${stage}${extra}`;
  memoryLog = [...memoryLog.slice(-(MAX_LINES - 1)), line];
  AsyncStorage.setItem(LOG_KEY, JSON.stringify(memoryLog)).catch(() => {});
  // eslint-disable-next-line no-console
  console.log("[BOOT]", line);
}

export async function readBootLog(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(LOG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return memoryLog;
}

export async function clearBootLog() {
  memoryLog = [];
  await AsyncStorage.setItem(LOG_KEY, "[]").catch(() => {});
}

export async function saveLastError(e: any, info?: any) {
  try {
    await AsyncStorage.setItem(
      ERROR_KEY,
      JSON.stringify({
        time: new Date().toISOString(),
        message: String(e?.message || e),
        stack: e?.stack ? String(e.stack) : undefined,
        componentStack: info?.componentStack,
      }),
    );
  } catch {}
}

export async function readLastError(): Promise<any | null> {
  try {
    const raw = await AsyncStorage.getItem(ERROR_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function clearLastError() {
  await AsyncStorage.removeItem(ERROR_KEY).catch(() => {});
}

/** Установить глобальные JS-обработчики: любые падения попадут в лог. */
export function installGlobalErrorHandlers() {
  const anyGlobal: any = global as any;

  if (anyGlobal.ErrorUtils?.setGlobalHandler) {
    const prev = anyGlobal.ErrorUtils.getGlobalHandler?.();
    anyGlobal.ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
      bootLog("JS_ERROR", {
        fatal: !!isFatal,
        msg: String(error?.message || error),
      });
      saveLastError(error, { source: "globalHandler" });
      if (typeof prev === "function") prev(error, isFatal);
    });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const tracking = require("promise/setimmediate/rejection-tracking");
    tracking?.enable?.({
      allRejections: true,
      onUnhandled: (_id: number, rejection: any) => {
        bootLog("PROMISE_REJECTION", String(rejection?.message || rejection));
        saveLastError(rejection, { source: "promise" });
      },
      onHandled: () => {},
    });
  } catch {}
}

/** React Error Boundary — перехватывает ошибки рендера. */
export class DebugErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: any; info: any }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error, info: null };
  }

  componentDidCatch(error: any, info: any) {
    this.setState({ info });
    bootLog("REACT_RENDER_ERROR", String(error?.message || error));
    saveLastError(error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <DebugScreen
          error={this.state.error}
          componentStack={this.state.info?.componentStack}
          showTryAgain
        />
      );
    }
    return this.props.children;
  }
}

/** Экран с логом загрузки и последней ошибкой. */
export function DebugScreen({
  error,
  componentStack,
  showTryAgain = false,
  onTryAgain,
}: {
  error?: any;
  componentStack?: string;
  showTryAgain?: boolean;
  onTryAgain?: () => void | Promise<void>;
}) {
  const [lines, setLines] = React.useState<string[]>([]);
  const [lastError, setLastError] = React.useState<any>(null);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const [log, err] = await Promise.all([readBootLog(), readLastError()]);
      if (!alive) return;
      setLines(log);
      setLastError(err);
    })();
    return () => {
      alive = false;
    };
  }, [tick]);

  const clearAll = async () => {
    await Promise.all([clearBootLog(), clearLastError()]);
    setTick((t) => t + 1);
  };

  const displayError = error || lastError;

  return (
    <View style={dbgStyles.container}>
      <Text style={dbgStyles.title}>🛠 DayFlow Debug</Text>

      {displayError && (
        <View style={dbgStyles.errorBox}>
          <Text style={dbgStyles.errorLabel}>Ошибка:</Text>
          <Text style={dbgStyles.errorText}>
            {String(displayError.message || displayError)}
          </Text>
          {displayError.stack && (
            <ScrollView style={dbgStyles.stackScroll}>
              <Text style={dbgStyles.stackText}>
                {String(displayError.stack)}
              </Text>
            </ScrollView>
          )}
          {componentStack && (
            <Text style={dbgStyles.stackText}>{String(componentStack)}</Text>
          )}
        </View>
      )}

      <Text style={dbgStyles.subtitle}>
        Boot log ({lines.length} строк, последнее — внизу):
      </Text>
      <ScrollView style={dbgStyles.logBox}>
        {lines.length === 0 ? (
          <Text style={dbgStyles.logLine}>(пусто — краш до JS)</Text>
        ) : (
          lines.map((line, i) => (
            <Text key={i} style={dbgStyles.logLine}>
              {line}
            </Text>
          ))
        )}
      </ScrollView>

      <Pressable style={dbgStyles.button} onPress={clearAll}>
        <Text style={dbgStyles.buttonText}>Обновить</Text>
      </Pressable>

      {showTryAgain && onTryAgain && (
        <Pressable
          style={[dbgStyles.button, dbgStyles.buttonPrimary]}
          onPress={async () => {
            await clearAll();
            await onTryAgain();
          }}
        >
          <Text style={dbgStyles.buttonText}>Попробовать снова</Text>
        </Pressable>
      )}
    </View>
  );
}

const mono = Platform.OS === "ios" ? "Menlo" : "monospace";

const dbgStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D1226", padding: 16, paddingTop: 48 },
  title: { color: "#fff", fontSize: 22, fontWeight: "900", marginBottom: 12 },
  subtitle: {
    color: "#aaa",
    fontSize: 13,
    marginTop: 10,
    marginBottom: 6,
    fontWeight: "700",
  },
  errorBox: {
    backgroundColor: "#2a1010",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  errorLabel: {
    color: "#ff8888",
    fontWeight: "800",
    fontSize: 12,
    marginBottom: 4,
  },
  errorText: { color: "#ff6b6b", fontWeight: "700", fontSize: 13 },
  stackScroll: { maxHeight: 120, marginTop: 6 },
  stackText: { color: "#ffb0b0", fontSize: 10, fontFamily: mono },
  logBox: {
    flex: 1,
    backgroundColor: "#111",
    borderRadius: 10,
    padding: 8,
    marginBottom: 10,
  },
  logLine: { color: "#7ee787", fontSize: 10, fontFamily: mono, marginBottom: 1 },
  button: {
    backgroundColor: "#3a3a4a",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  buttonPrimary: { backgroundColor: "#7C3AED" },
  buttonText: { color: "#fff", fontWeight: "800" },
});
