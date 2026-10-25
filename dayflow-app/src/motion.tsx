import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  ImageSourcePropType,
  Pressable,
  StyleProp,
  TextStyle,
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
      <Animated.View style={{ opacity: anim }}>
        <Image
          source={ICONS.check}
          style={{ width: 14, height: 14, tintColor: "#FFFFFF" }}
          resizeMode="contain"
        />
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Title with a strike-through line that draws itself across the text.
 *
 * FIX: раньше `style` имел тип StyleProp<ViewStyle>, хотя компонент
 * рендерит <Animated.Text> и реально принимает текстовые стили
 * (fontSize, fontWeight, color и т.д. из styles.rowTitle в App.tsx).
 * TypeScript не компилировался из-за несовместимости ViewStyle/TextStyle
 * в месте вызова <StrikeText style={styles.rowTitle} />. Теперь тип
 * корректно указан как StyleProp<TextStyle>, а каст `as never` убран.
 */
export function StrikeText({
  text,
  done,
  style,
  lineColor = "#9AA0BC",
}: {
  text: string;
  done: boolean;
  style?: StyleProp<TextStyle>;
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
          style,
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
 * Использует встроенный Image — без нативных зависимостей.
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
          <Image
            source={image}
            style={{ width: size * 0.66, height: size * 0.66 }}
            resizeMode="contain"
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

/** Иконка-картинка (PNG). Белые глифы красятся через `tint`. */
export function Icon({
  source,
  size = 22,
  tint,
}: {
  source: ImageSourcePropType;
  size?: number;
  tint?: string;
}) {
  return (
    <Image
      source={source}
      style={{ width: size, height: size, tintColor: tint }}
      resizeMode="contain"
    />
  );
}

/* ------------------------------------------------------ встроенные иконки */
/** PNG-иконки, встроенные в код (отдельные файлы не нужны). */
export const ICONS: Record<string, { uri: string }> = {
  sport: { uri: "data:image/png;base64,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" },
  study: { uri: "data:image/png;base64,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" },
  leisure: { uri: "data:image/png;base64,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" },
  trophy: { uri: "data:image/png;base64,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" },
  spark: { uri: "data:image/png;base64,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" },
  plus: { uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAADj0lEQVR42u2dvWsUQRjGn3cvSSEYC23ED4T4EURLJX6AgiA2YmtjJeL/ZBUtbGzEIoVpJIWEaGGlKBIkREEPVFBDPu7usbh3yHIkese+a27X5wfLLmFnd+Z9Zt6deWduAgghhBBCCCGEEEIIIYQQpWNVzThJy+WfZkbJ+Y8MT7Kxxd8zkplaQLnGz8ys49d7ARwGkAFYNrPPvfeIYOP7+RDJaZJNbvKN5COSk/l7RbzxJ0ku5wzf8SPxleSURIj3+RnJMZKv3NBrPYbvkFz36yWS457OZMHiAjT8fMMNvMHtSSLc9TQjw16+KjTTVIuvAGAf99LvrQRV8pPjffTa0thgd2pAEiCOTkn3SoASxiwmAYQEkABCAkgAIQEkgJAAEkBIAAkgJIAEEBJgmAifsvN52AxxIeERkhjweebTkY3geeF29AKwkWDjpzU57cDHtvzZawOkWTezVkpbUhlDsOiM+ST6dQCXAOwJeEeG7gzXRQBH/Xo710l/30cAs9icIy5UNAA/ATwH8NjMViNFsGDjnwQwDeBMTV32awC3zWw+SgSLML7XkgMAFgDsL6PpA2gMkF8Gu8G8y/4BYArAGwBWVIQIARpm1ib5AMAtAOsAxmraAjYAjAKYNbOrEa3AChrfzIy+UHYRm8tB6roiLX1P2gBOmNliURGKjgNS+iPortups/FT2Truio5HlDcLzNj/RkiZiwqQmt4SgF89zbTO0YOOu9zC5S0kgPv/hpl9AfDUa0Wrxsbf8DLOA3i34x/hnm7oMQAv/Fuwgfg40yDhDSJ+eWLHe0AtABfMbCH1AIdpIHYewH0fsdaRTwDumNnM0AzEthBhHMBNAJc9FFH0PSmccBrAwVy44U+hiCaAlwGhiJQ2hSIemlkzouaX00ku8WdBJO/18QONlp+flJiPRvTQOq5f1m0B5mEDBuaxNeDoetQN1QgMSRi64ej20AqQekaRPSEfbbfpkwL9JvM0GEpXUcJATEgACSAkgAQQEkACCAkgAYQEkABCAkgAIQEkgKiJANquZodZwd9n2ejHSlWEqJIAc30YNE3Kz8m5BZG2nyS5i+T7nt0R86TJ+ibJfdq2MlaEtHHrWZLfc0Zv+8HcfqLX8mlEvAinSM6QXO2p/c9Inqua8au8efcEgAkvwwcze9t7jyhJhK1qeNriuGrlqfI/cMgv1qVqvRBCCCGEEEIIIYQQQgixLb8B6FCV2MEMBiUAAAAASUVORK5CYII=" },
  check: { uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAADr0lEQVR42u2cv2sUQRzFv3Obs0iqIEZQO08sBINogthZaSqVFFamt9bGzjZoZaGdP0AbsVNTW1joP6AYtRHEKFYaozl391k4C183d97e7Oxe5vZ94Nhjs5Dse/Pj+2aGiBBCCCGEEEIIIYQQQgghhBBCCCGEjCOGEvQHgBGRKHc7NcakVKd68SOXn7EH+BG/ZYxJAewUkbMiclRE2iLySkQeG2PeATDGGFAt/+JP2OsigI/YygaAK757AvlX/DNK8N+5T2rvX6UJ1Yg/D+A7gARA3KMHJNYIADiSDVlU0MOEC+AAgM9K6H5kBtzQ5rnQovhoGWMSADMisiIiMyKSDNAmK14OZ6UpDXAU/+8FkyLyREQ6IhL3qP0rqyJbDRbfWAGNiDwSkTkrfpHhBPbzmg3ZUXw16d7LjeuDSNWzJ1gJuRnQttdrVsguitPNTcAU31H8y0O2fP3sfduLIjuUkSFr/SUlaDqk+E+t+C2K7yb+ggpZw4r/AsCkFZ8Tr2PKXbfCJwXFz9LwG5sVmHxLpNy1Aik3v+wAAJ8AdDjpugUtAbAbwGquRRcRP7XrQnMU30F8O1lOAXjpUOvH1oRTZdd7mhq0ImvCSomgdUGXriGKYOou1UqmXP3spSDFt60uyk+EdVUOSvwyKXc5VPEjnTgBTOuxs+pJrEfKdRH/TmZkUEFLlXuztuu/BfDVVh+3ARyqcjLzmHJbwS0xqHJvCcDPPi+5DuB8FV3bc8o1obb847mXSlTi7KoafMFnT1DizwH44ZhyVwHsCjLlqtb/bEDFkRmyqUxoezK/U3Avt1fKXQs25Srx9wL4ZQVOC6TL0iao3z1j55vmpVzVAudViCn68puuw5GnlBsDOB10ylWt8OAQXb9UT1ApN2psyu2RdncAeG+FTaoywUPK7QadcgdUIRcdws9Qw5GnvdzlsVtcU0PRA08mtCtKuXeDTLkFh6LMhFu+TWh0yh2xCRO5lBuXSLlT+m8c63V4nyaoMpd7uSMw4SSAfSVT7v5gg9aITQCAbwA+OIif2h5zrHHiezQh7fOde7k1m5A0MuVuIxOasZcbuAnjm3IDMGG8U+42NyF/YpnHxWs0oddeLg/N1mQCTyyP0ASeWB6hCTyxXLEJN9X4HqtNfh2ymHIrNuH6f3rABoBzFL86E7L9hEUAz+1QEwP4AuAhgFmKX70RLfV9jz1xMa3uccyvwYQtgarOI+51YgLpDeC/ByOEEEIIIYQQQgghhBBCCCGEEBIafwAJSQS06HeM9wAAAABJRU5ErkJggg==" },
  play: { uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAEcElEQVR42u2cTYgcVRSFz+3qQDRuRiTizyIS3GjEhfi7CIgBFxIVNyLBlSjoKiBEUCSiA4Iuoi7EgG5EdHAlKm40yICCiTooGISAwRBURIghSAwzXf25mFfkpWcyTsaq6nbqfFB0T9M9XX3Pe+feW1WvJGOMMcYYY4wxxhhjjDHGGGOMaYwY9w4AvbQfw4jAkrQf/PzvYvQ101zwIz1uBW4FNo8IEY5SwyMfmAbOsMgJYAa4I3tf39GqP/hFerybsww5l7eAq6uZUn3G1CNAPz2+DZTAfCbCIBPjD+CJzKpsS3V5f9q+ToEesJSF7PkXI7bk2VBD4i2An1KAS5ZnmIkzBF4DLqtyiKul/ybARuD4vwhANkMqWzoOPJzbmW1pbQJcCvx5ngR8PnJb+gS40ba0dgGmUtl5IQKM2tIZ4AXgEttSewKwTOL+EbjfttSuANXnclt6H7jWttSeAGRJvJoRp4A9wAb3Du0JsJwtfQPs+D8c0lhPSauQhKSBpJskfQq8CVwVEYPU/PUsQLOEpL6kYdoekTQHPB4RRMRw0pL0ei3bemkbSNos6XVgFrgtIgYRwaQk6fVeN/eTLZWStkv6EtgHTEVEOQm9Qxcal0j5oUzPdydb2hURw3HbUpc6xyIJMJC0RdI7wMfADeO0pS627lWSLiXdI+kg8DywKdlSq+elu3rspJfZ0kWSnpV0CLgvIsrKlixAu73DdZI+SOelr2mrd/DRw6W9w4OSvgV2Z71DzwK01zuUkqYk7QM+A7Y0KYIFWNmW7kq9w/VNiWABVralBUlXSpoBNkqi7n7BAqzMhjQTtknanq5d7VmA8YnhHNAyg2RFP0uaTfYztADNQxb8U5Ieioi/JEXdl9BbgKWUWRL+Lnn/V0AvIoZ1f5kFOHfUl6kMnZf0oqTbI+J7oGgi+Eoqm7N2U0g6IGlPRMxpse7sRUTpTrgZhmnk9yX9KunRiNgREXPVOYKmRn7XZ0BlN9Xv3y9pb0T8XnW7ETFoY0e6KEDl831JByU9FRGzyW76bQW+iwJUVlJIOiFpWtKr6RhPocVVmoO2d6oLAozazbuSno6IY2nUF00m2a4n4bym/0HSzojYFRHHqjNe4wz+ep4BVXVTSDot6SVJL0fE6WQ3jMNuuiLAIPtdHya7OTwJdrPeBSiTpfYlHZX0TETMVNWNpHLSgr9eBCBZTnWVwyuSpiPiZNs1/eRHqv7L0/MFGp8Dt2Tf5QUaDQpQZp/7DXgs+w4vUWpQgNFlSfuBK6r/7UV6qxdgLctU8xUwh4A781Hv6F6YABcDv6xyoXaZveck8GR2vwmvAVujAAVwdBW3Ksjt5j1gq5NsDSKkbW6Fm3Xkrx0Gdtpu6hOgso+ZNPoXRlbBVzPib+A5YFM2a5xkaxCgumHTA9loH50FHwHbbDfNidBL2xtZ0OeBA8C9XarpJ+G2lTdLulzSkYg4UgmUDiEMPVxbqIpGEnSn7GYSZkAVcDzijTHGGGOMMcYYY4wxxhhjjDGmVv4BHzNo2i2hHf0AAAAASUVORK5CYII=" },
  pause: { uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAACo0lEQVR42u2cvYoUQRhF79ezouDPyiIYKb7AKpgYCYIvsIEv4WMIPoCYGZqIpiouCMYqipEoBqY+gIvu6kz3NbAam2HHqe7d6dlpzoGmG6aKr6pPVfVEVwIAAAAAAAAAAAAAAAAYMrGswrYLScWcZlVEVKtQZ2WwHeml5LYf2Y6OtUYtxxWD3gG2IyKcnjclbUo6NjUOp/uepPcR8fWANS9Iuibp5D5ztqRS0qeI+DA9xsGt/HQ/Z/uJ7dLz2bV93/Zx20XOCq13WLru2v7uPF7Yvtgc6+COHdsnbL9JEy5tT2yPZ1wT21Vq+6hxnmcdO7bvNV7u/+qMG4vhi+2zyzqOFilgLd1vp4n+ylyVle3f6fnmvHO9FmT7Suozztxptr2X7neaY140RV8O0v2WpEpS7scx0uXUd953q57PVoc5rqWxbaXVXw5JQP0Xb71jzZC00aL9RscahaQzkkYR4T6OoaLn0+gg/7XLBbU9zDEeeQHRU99Y0hiPvABAAAIAAQgABCAAEIAABPAKEIAAQAACAAEIAAQgABCAAEAAAgABCAAEIAAQgABAAAIAAQgABCAAEIAAQAACAAEIAAQgoCXuqa8RcPj1ip7qDDKqoJ7UD3ULw7CknRbtdzrsAqfrp6Sqr+iyomfRz9JzmzSTKgl8mnG81L8917+codyXWKY+2ylBcaShUEeA2T5t+3NmjFgdW2bb23UOXEatOrLsYSMabZxx2fY32+fbJjuuioQ6TuyS7VfO57Ht9dwct6l8ugctIsvepiRH9fnylxlbeUPSVf2NrWyOpT4ydiW9joh3031b1rws6bqkUzPqTCR9lPQypWQVgw5xbbu6cuMqZ+2ERY5t5XbAPmf1vPp9RRc71bIAAAAAAAAAAAAAAAAA4BD5A2C+LPltUEOwAAAAAElFTkSuQmCC" },
  reset: { uri: "data:image/png;base64,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" },
  home: { uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAFbUlEQVR42u2dT+hUVRTHP+fNpJmBRbaQChchlasiConKTUmZERHlRnctCgLdBbWRIFpEELoIAsEMwv6AKLkoJbM2ZREWgW36R0mQSoaF6e83823xO5cuw0+b38x7M+/NnC8Mvxlm3nv3fr/3nHvOue/dHwQCgUAgEAgEAoFAIBAIBPqBJJNkwcToiS8ktS72OVAt+TnxV0i6cr7vAtW4m5a/v13S25J+kXRC0j5J92bWEG6pQvK3SLqg+bEt+30RzJXn783fv+pEdyXN+N+upFlJHf9ut6R2OjYYHJL85NslvekEJ+LnQ7KMA2luiHlhyMlW0lJJ+3sIvhTSbz6VdG2IMBz5y53IfslXZiWS9I2klX6udjDbH/nJf9/gBOaEagARfpK0OkRYGPm3SPpxCPITZv3vSUlrQoT+yL/TCcsJVAki/C1pXYhwafLvl3S2RPITOpk1bQwR5if/iczddFQ+Oln4+nS69tRmzZ6tJvKfyhKsKshXdv5kWc9nOYZNM/nPzTNCNSIRXpm6+lFep5H0cubvR0G+ekoZkrRzaupHPXWd1/soLVSNJMJ7khZNdNacjfpFkt4tIcYvCynDPiRp2USKkJUWlkn6cIDSwqhEOCppxUSFqdlku0LS5zUkv9cdHZe0alQiWNXkm9mspBuB94GbgVmgrqMrte0EsMHMjqU+VHXBYgTk3wocaQD5eNs6wHXAYUlrvQ/tRgmQkX83cNg71Kk5+Qktb+tVwAeSHq5ShKJC8h8CDnpHOt6xpqAFdIFFwD5Jm6sSoaiI/M3AfuBy70gTw7rEjYDdkrYmEWqXNfeUFrZkpYWOmo+8dPFC7epHPbeMbBtTaWGUIuzIsvqhPYgNSz5gZtb1hj3j/r6oOsQdc5j6FrDJzCSpMLPuyAVI5PvHXcDmBoSZZYpwAHgc+Ie5UaiRCeDkF2bWkbQH2AjMAJdNSUU99fUQsN6tXoOIMKgPS+S/6ORfmCLy8b7OAPcBr7kLKkZiAcnnSboN+MpNsjWhPr9fd7TOzA5KaplZp2oLSMdsyBoxjZD3vQs8OuiAbg94Yby+0/VkC39faX2pJug6B62s7wd7uKnOAtz3m5l9AqwF9gC/+bmKTIhJJb9w8k8Be4EHzGyvc9JZMJ/DhKFp1pd0NXAP8CxwV9bQSST/a+Al4CMzO9nLxagTscITsU72+R3gsQYW4C6F1JePgfVmdi6VJJJXGEsm3JMXtM1sxq3he+aqoKVdY8yTLR5qrzazH3wBf2bQUV9GHtA7L8jJb5vZH8ytAZiPnElwPQZ86eS3zOxCGeRXErG4NRyfsHAT4Lue8gu1FMBHxukJjIBOlTXqKxVg0Hi4QZbQCAECFWbC4woDF+J/lWWrIUAJpr9QIi071kKA4bPP/cB24Gw2ui9GvAFLgCeBTXXPytsNIP8LM3tkgOOPSLoGeLDOWXlRcwFgbukPSYvTtjT/8yr8twbsq3tU1oQ5IG3K1Ol38VtSxxfMa18GaUQYWkUCFAIEQoAQIBAChAAhQCAECAECIUAIEAgBQoBACBAClIJJfFbAmiTAuQkU4FyTBDjD5N0b9GcTBEikn3STLcZs+mW6jd+bIEBaMjwG/OWCDPvARneQpUU/plvCgErn+aynj/UTwNdhW2Z2GtjBf3cizA7xag+yJOnHtIa8djrHruzO6Ho/AZR2H/Q7FLZLOj/kNgFnJN3U766G6T8rSbpe0s8lbPb6hqQlVW1taSMQZBWwBlgJLAcWL6BtacuY48DONBFezCIygpYyd1PWHcB5t/R+rWiGuee/fgWOmtm3jQ0bJmEfzqo3dbURiTCsEN2F+t5xXTcQCAQCgUAgEAgEAoFAoMb4F2Ze4e2ENvxbAAAAAElFTkSuQmCC" },
  stats: { uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAEBElEQVR42u2dv6scVRiGn292oyKScEUwIKJoI0kjFkr0P4iFYmWRTizFRsTCyiZVooggaG9lSKNiEfwHJI2NoIIaJEVEI4jh5t7deS3mG3YId7Pz67p73feBYbaY8+3M+545Z+ecb86CMcYYY4wxxhhjjNkWwhIskLRSj4iQlRpf+Ekb8bse6zugZa2va7WkE0Bxl8P/iYi9PLaIiNIGDBO/iIhS0uvAa8ATwOQAXepm5yZwBXgvIq43zTM9xM/9x+rOL5IelxR1HNOxzc/9SynonqSZpHLFNpe0m2W+bBpp+hlwOUXd71D7y0aZx4aasK3u1Z3no6lBl76wPnaa5Qf1pdt++2jN5XH7tWZsgA2wAcYG2ABjA2yAWQPTIzaEEC2eOnWURiinR0j4IiLmbZ4+c6ynPApGTI+C+CnkPCdMHl5xF/weEX/eUdYGDBFf0g5wHngZeOgufZeAm5K+Bt72pMlA8SUVko5Lutpj0uQnSSczThzQpCHp2zx21jH2PPcvNJq8/92voEnOub4DPAPczhreZrsNPAmcz9q/sddZbGrtzzZ/ArxCNX5/LNv+Nts9WeaspAciYj5mJsNWPAdkzb0feJDukyb1tR0HduqQNqDnDbHm8n4S9lCEsQE2wNgAG2BsgA0wozL6aGjmSbaZNCkt/4gG1Ln2bYVNo7TtQ8XTMcXPz6epJk3EwS86CPg1In7O47d6vH46lviSngM+AJ5t0bfsSvoKeGPbJ02mQ8Wvdnoa+IZq9FIs0r+XcR/VMPMpSc8Df22rCYN/BaVoF1L8vWx2ihVbPWnyFPBWxphs4x1QDKj9kU3PSeBMinqsrW9595XAi/UEjA3oWPlzv5NNSvQoXwAnqKYftamzVpv+IFauubyfhId2IzbA2AAbYGyADTA2wAYYG2ADjA2wAcYG2ABjA2yAsQE2wNgAG2A21oDDnNONDT4/jRF7DANmDMtsKFn+KukYsWc9v7uNsbN1GlDn8fwGXKdKrFIP4b/PN9kndWpi5ggVEXEL+DGPnXeMXQLXgBt5ns1zq7Pwvkshyx7n/XeeG0MqSW8D6jUYImIX+DAvap61Yr5i22exTPz7K5qOCyzelG8Te5YCFcDFXGOouCPvtBbsIxbLIOy3jD3Lc/8kIv5oVpz/nMaKJiHp0x4rjryZcYol8esl5t/tsVrKxZaxz0m61TH255Lura997R1UY12fs1Rr+jyyJH6dOf0D8FlEXF31TxSN9PczwKtUq6AEy/9k4RpwKSKurMq4bsQ+BZwDTlPlrC6LfQP4IiIuNa97I35O9VnCvW2ZQ4496Xnnj1J5Y2QT6nZdLb637PKeWMfYyra/i1nFYcQ2xhhjjDHGGGOMMcZsCP8CLs68pSc8MJ0AAAAASUVORK5CYII=" },
  settings: { uri: "data:image/png;base64,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" },
  volumeOn: { uri: "data:image/png;base64,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" },
  volumeOff: { uri: "data:image/png;base64,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" },
};
