import gsap from 'gsap';

import { FINE_POINTER } from './media';

const INTERACTIVE = 'a, button, [role="button"]';
const ACTIVE_CLASS = 'has-cursor';
const VISIBLE_CLASS = 'cursor-visible';

function followPointer(ring: HTMLElement, dot: HTMLElement): () => void {
  const root = document.documentElement;
  const ringX = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3.out' });
  const ringY = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3.out' });
  const dotX = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'power2.out' });
  const dotY = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'power2.out' });
  let hovering = false;

  const onMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse') return;
    if (!root.classList.contains(VISIBLE_CLASS)) {
      gsap.set([ring, dot], { x: event.clientX, y: event.clientY });
      // Re-entry starts from the idle state, so the hover check below reapplies both scales.
      hovering = false;
      gsap.killTweensOf([ring, dot], 'scale');
      gsap.set(ring, { scale: 0 });
      gsap.set(dot, { scale: 1 });
      root.classList.add(VISIBLE_CLASS);
    }
    ringX(event.clientX);
    ringY(event.clientY);
    dotX(event.clientX);
    dotY(event.clientY);

    const overInteractive = event.target instanceof Element && event.target.closest(INTERACTIVE) !== null;
    if (overInteractive === hovering) return;
    hovering = overInteractive;
    gsap.to(ring, { scale: hovering ? 1 : 0, duration: 0.4, ease: 'power3.out', overwrite: 'auto' });
    gsap.to(dot, { scale: hovering ? 0 : 1, duration: 0.3, ease: 'power3.out', overwrite: 'auto' });
  };

  const onDown = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse') return;
    const target = hovering ? ring : dot;
    gsap.fromTo(target, { scale: 0.6 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.5)', overwrite: 'auto' });
  };

  const onLeave = (): void => root.classList.remove(VISIBLE_CLASS);

  root.classList.add(ACTIVE_CLASS);
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });
  root.addEventListener('pointerleave', onLeave);

  return () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerdown', onDown);
    root.removeEventListener('pointerleave', onLeave);
    root.classList.remove(ACTIVE_CLASS, VISIBLE_CLASS);
    gsap.killTweensOf([ring, dot]);
    gsap.set([ring, dot], { clearProps: 'all' });
  };
}

export function initCursor(): () => void {
  const ring = document.querySelector<HTMLElement>('[data-cursor-ring]');
  const dot = document.querySelector<HTMLElement>('[data-cursor-dot]');
  const media = gsap.matchMedia();
  if (ring && dot) media.add(FINE_POINTER, () => followPointer(ring, dot));
  return () => media.revert();
}
