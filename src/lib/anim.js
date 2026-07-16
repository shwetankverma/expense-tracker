import { useEffect, useRef, useState } from 'react';

// Animated count-up for hero numbers. Eases out over `duration` ms,
// re-animates when the target changes. Respects prefers-reduced-motion.
export function useCountUp(target, duration = 650) {
  const [val, setVal] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const from = prev.current;
    prev.current = target;
    if (reduce || from === target) {
      setVal(target);
      return undefined;
    }
    let raf;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(from + (target - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return val;
}
