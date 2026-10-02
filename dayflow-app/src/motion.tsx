import { LinearGradient } from "expo-linear-gradient";
import { Image as ExpoImage } from "expo-image";
import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleProp,
  View,
  ViewStyle,
} from "react-native";

/** Tracks the OS "reduce motion" setting so animations stay accessible. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive) setReduced(value);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (value) => setReduced(value),
    );
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

/** Fades and lifts content into place, with an optional stagger delay. */
export function FadeSlide({
  children,
  delay = 0,
  offset = 20,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  offset?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: reduced ? 0 : 420,
      delay: reduced ? 0 : delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, delay, reduced]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [offset, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Pressable that springs down on touch for tactile feedback. */
export function Tappable({
  children,
  onPress,
  onLongPress,
  style,
  disabled,
  scaleTo = 0.96,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  scaleTo?: number;
  accessibilityLabel?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();

  const spring = (toValue: number) => {
    if (reduced) return;
    Animated.spring(scale, {
      toValue,
      friction: 7,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        disabled={disabled}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={() => spring(scaleTo)}
        onPressOut={() => spring(1)}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/** Progress bar that eases to its new value instead of jumping. */
export function ProgressBar({
  value,
  color = "#FFFFFF",
  track = "rgba(10, 12, 28, 0.45)",
  height = 8,
}: {
  value: number;
  color?: string;
  track?: string;
  height?: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    Animated.timing(anim, {
      toValue: Math.max(0, Math.min(100, value)),
      duration: reduced ? 0 : 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [anim, reduced, value]);

  return (
    <Animated.View
      style={{
        height,
        borderRadius: height,
        backgroundColor: track,
        overflow: "hidden",
      }}
    >
      <Animated.View
        style={{
          height: "100%",
          borderRadius: height,
          backgroundColor: color,
          width: anim.interpolate({
            inputRange: [0, 100],
            outputRange: ["0%", "100%"],
          }),
        }}
      />
    </Animated.View>
  );
}

/** Counts a number up or down so metrics feel alive. */
export function useCountUp(value: number) {
  const anim = useRef(new Animated.Value(value)).current;
  const [display, setDisplay] = useState(value);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    const id = anim.addListener(({ value: current }) =>
      setDisplay(Math.round(current)),
    );
    Animated.timing(anim, {
      toValue: value,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(id);
  }, [anim, reduced, value]);

  return display;
}

/** Breathing dot used to show a live timer. */
export function PulseDot({
  active,
  color,
  size = 11,
}: {
  active: boolean;
  color: string;
  size?: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    anim.setValue(0);
    if (!active || reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 900,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, anim, reduced]);

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size,
        backgroundColor: active ? color : "#3F4761",
        transform: [
          {
            scale: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 1.45],
            }),
          },
        ],
        opacity: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.55],
        }),
      }}
    />
  );
}

/** Checkbox that pops and fills when a task is completed. */
export function AnimatedCheck({
  checked,
  color,
}: {
  checked: boolean;
  color: string;
}) {
  const anim = useRef(new Animated.Value(checked ? 1 : 0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    // FIX: раньше при reduced=true анимация всё равно запускалась через
    // Animated.spring с useNativeDriver: true, при этом анимируется
    // backgroundColor — Native Driver НЕ поддерживает анимацию цвета и
    // кидает Invariant Violation ("Style property 'backgroundColor' is
    // not supported by native animated module"). Это реальный краш на
    // устройствах с включённым "уменьшить движение" в Accessibility.
    // Теперь: при reduced — мгновенно выставляем значение без анимации,
    // иначе — анимируем с useNativeDriver: false (обязательно для цвета).
    if (reduced) {
      anim.setValue(checked ? 1 : 0);
      return;
    }
    Animated.spring(anim, {
      toValue: checked ? 1 : 0,
      friction: 6,
      tension: 160,
      useNativeDriver: false,
    }).start();
  }, [anim, checked, reduced]);

  return (
    <Animated.View
      style={{
        width: 24,
        height: 24,
        borderRadius: 8,
        borderWidth: 1.5,
        alignItems: "center",
        justifyContent: "center",
        borderColor: checked ? color : "#565C77",
        backgroundColor: anim.interpolate({
          inputRange: [0, 1],
          outputRange: ["rgba(0,0,0,0)", color],
        }) as unknown as string,
        transform: [
          {
            scale: anim.interpolate({
              inputRange: [0, 0.6, 1],
              outputRange: [1, 1.18, 1],
            }),
          },
        ],
      }}
    >
      <Animated.Text
        style={{
          color: "#FFFFFF",
          fontSize: 14,
          fontWeight: "900",
          opacity: anim,
        }}
      >
        ✓
      </Animated.Text>
    </Animated.View>
  );
}

/** Title with a strike-through line that draws itself across the text. */
export function StrikeText({
  text,
  done,
  style,
  lineColor = "#9AA0BC",
}: {
  text: string;
  done: boolean;
  style?: StyleProp<ViewStyle>;
  lineColor?: string;
}) {
  const anim = useRef(new Animated.Value(done ? 1 : 0)).current;
  const [width, setWidth] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    Animated.timing(anim, {
      toValue: done ? 1 : 0,
      duration: reduced ? 0 : 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [anim, done, reduced]);

  return (
    <Animated.View style={{ alignSelf: "flex-start" }}>
      <Animated.Text
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={[
          style as never,
          {
            opacity: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0.55],
            }),
          },
        ]}
      >
        {text}
      </Animated.Text>
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          top: "52%",
          height: 1.6,
          borderRadius: 2,
          backgroundColor: lineColor,
          width: anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, width],
          }),
        }}
      />
    </Animated.View>
  );
}

/** Slow rotation used for decorative celebration sparkles. */
export function Spin({
  children,
  duration = 9000,
}: {
  children: React.ReactNode;
  duration?: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, duration, reduced]);

  return (
    <Animated.View
      style={{
        transform: [
          {
            rotate: anim.interpolate({
              inputRange: [0, 1],
              outputRange: ["0deg", "360deg"],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** Springs a modal card into view. */
export function PopIn({
  children,
  visible,
  style,
}: {
  children: React.ReactNode;
  visible: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      anim.setValue(visible ? 1 : 0);
      return;
    }
    if (visible) {
      anim.setValue(0);
      Animated.spring(anim, {
        toValue: 1,
        friction: 7,
        tension: 120,
        useNativeDriver: true,
      }).start();
    } else {
      anim.setValue(0);
    }
  }, [anim, reduced, visible]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: anim,
          transform: [
            {
              scale: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.86, 1],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Falling confetti pieces for the celebration screen. */
export function Confetti({ count = 14 }: { count?: number }) {
  const reduced = useReducedMotion();
  const pieces = useRef(
    Array.from({ length: count }, (_, index) => ({
      anim: new Animated.Value(0),
      left: `${(index * 100) / count + 3}%`,
      delay: index * 90,
      color: ["#A78BFA", "#60A5FA", "#22D3EE", "#F0ABFC"][index % 4] as string,
      size: 6 + (index % 3) * 3,
    })),
  ).current;

  useEffect(() => {
    if (reduced) return;
    const loops = pieces.map((piece) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(piece.delay),
          Animated.timing(piece.anim, {
            toValue: 1,
            duration: 2600,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(piece.anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [pieces, reduced]);

  if (reduced) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: "absolute", top: 0, left: 0, right: 0, height: 260 }}
    >
      {pieces.map((piece, index) => (
        <Animated.View
          key={index}
          style={{
            position: "absolute",
            left: piece.left as never,
            width: piece.size,
            height: piece.size,
            borderRadius: piece.size / 3,
            backgroundColor: piece.color,
            opacity: piece.anim.interpolate({
              inputRange: [0, 0.15, 0.85, 1],
              outputRange: [0, 1, 1, 0],
            }),
            transform: [
              {
                translateY: piece.anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-30, 250],
                }),
              },
              {
                rotate: piece.anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0deg", `${index % 2 ? 420 : -420}deg`],
                }),
              },
            ],
          }}
        />
      ))}
    </Animated.View>
  );
}

/* ----------------------------------------------------------- new additions */

/**
 * Глянцевый "3D"-бейдж вместо плоского эмодзи-стикера: градиент + блик +
 * внутренняя тень снизу создают иллюзию объёма. Если передать `image`
 * (require(...) на реальную PNG/3D-иконку), она покажется вместо эмодзи
 * с плавным fade-in (expo-image transition). При монтировании слегка
 * "выпрыгивает" пружиной для живости интерфейса.
 *
 * Требует зависимость `expo-image` (npx expo install expo-image).
 */
export function GlossyIconBadge({
  emoji,
  image,
  gradientColors,
  size = 46,
  style,
}: {
  emoji?: string;
  image?: any;
  gradientColors: readonly [string, string, ...string[]];
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      scale.setValue(1);
      return;
    }
    Animated.spring(scale, {
      toValue: 1,
      friction: 6,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }, [reduced, scale]);

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          shadowColor: "#000",
          shadowOpacity: 0.35,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
          transform: [{ scale }],
        },
        style,
      ]}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0.15, y: 0.1 }}
        end={{ x: 0.9, y: 1 }}
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.32,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -size * 0.2,
            left: -size * 0.2,
            width: size * 0.7,
            height: size * 0.7,
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.35)",
            transform: [{ rotate: "-20deg" }],
          }}
        />
        {image ? (
          <ExpoImage
            source={image}
            style={{ width: size * 0.62, height: size * 0.62 }}
            contentFit="contain"
            transition={200}
          />
        ) : (
          <Animated.Text
            style={{
              fontSize: size * 0.46,
              color: "#fff",
              fontWeight: "900",
              textShadowColor: "rgba(0,0,0,0.25)",
              textShadowOffset: { width: 0, height: 2 },
              textShadowRadius: 3,
            }}
          >
            {emoji}
          </Animated.Text>
        )}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "45%",
            backgroundColor: "rgba(0,0,0,0.18)",
          }}
        />
      </LinearGradient>
    </Animated.View>
  );
}

/**
 * Мягкое "дыхание" по вертикали для декоративных элементов — иконки,
 * трофеи, искры и т.д. Создаёт ощущение, что объект реально парит,
 * а не статично нарисован.
 */
export function FloatY({
  children,
  distance = 6,
  duration = 2200,
}: {
  children: React.ReactNode;
  distance?: number;
  duration?: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, duration, reduced]);

  return (
    <Animated.View
      style={{
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [-distance, distance],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Пульсирующее свечение позади элемента — хорошо смотрится под акцентными
 * кнопками (например "Начать таймер" или главная CTA-кнопка).
 */
export function GlowPulse({
  children,
  color,
  size = 70,
}: {
  children: React.ReactNode;
  color: string;
  size?: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 1100,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, reduced]);

  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.0, 0.35],
          }),
          transform: [
            {
              scale: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.75, 1.15],
              }),
            },
          ],
        }}
      />
      {children}
    </View>
  );
}

/**
 * Бегущий диагональный блик — полезен для скелетонов загрузки или чтобы
 * "оживить" статичную картинку/карточку лёгким движением света по ней.
 * Оберните контент в `overflow: "hidden"` контейнер снаружи при необходимости.
 */
export function Shimmer({
  width = 120,
  height = "100%",
}: {
  width?: number;
  height?: number | string;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, reduced]);

  if (reduced) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        width,
        height,
        transform: [
          {
            translateX: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [-width, 400],
            }),
          },
          { rotate: "12deg" },
        ],
      }}
    >
      <LinearGradient
        colors={[
          "rgba(255,255,255,0)",
          "rgba(255,255,255,0.18)",
          "rgba(255,255,255,0)",
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );
}
