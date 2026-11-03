import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

import { FULL_MOTION, REDUCED_MOTION, WIDE } from './media';

// Below 600px of height a card no longer fits one viewport, so the pinned strip falls back to a stack.
const HORIZONTAL = `${WIDE} and (min-height: 600px)`;
const STACKED = [`${FULL_MOTION} and (max-width: 899.98px)`, `${FULL_MOTION} and (max-height: 599.98px)`].join(', ');
const HORIZONTAL_CLASS = 'is-horizontal';
const CLIP_HIDDEN = 'inset(100% 0% 0% 0% round 1rem)';
const DEFAULT_LAG_THRESHOLD = 500;
const DEFAULT_LAG_ADJUSTED = 33;

export interface MotionOptions {
  onHeroProgress: (progress: number) => void;
  onJourneyProgress: (progress: number) => void;
  onFinaleProgress: (progress: number) => void;
}

function startSmoothScroll(): () => void {
  const lenis = new Lenis({ autoRaf: false, anchors: true });
  const raf = (time: number): void => lenis.raf(time * 1000);

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(raf);
  gsap.ticker.lagSmoothing(0);

  return () => {
    gsap.ticker.remove(raf);
    gsap.ticker.lagSmoothing(DEFAULT_LAG_THRESHOLD, DEFAULT_LAG_ADJUSTED);
    lenis.destroy();
  };
}

function trackJourney({ onHeroProgress, onJourneyProgress, onFinaleProgress }: MotionOptions): void {
  gsap
    .timeline({
      scrollTrigger: {
        trigger: '[data-hero]',
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        onUpdate: (self) => onHeroProgress(self.progress),
      },
    })
    .to('[data-hero-copy]', { yPercent: -30, opacity: 0, ease: 'none', duration: 0.5 }, 0)
    .to('[data-hero-hint]', { opacity: 0, ease: 'none', duration: 0.1 }, 0);

  ScrollTrigger.create({
    trigger: '[data-hero]',
    start: 'bottom bottom',
    endTrigger: '[data-finale]',
    end: 'top bottom',
    onUpdate: (self) => onJourneyProgress(self.progress),
  });

  ScrollTrigger.create({
    trigger: '[data-finale]',
    start: 'top bottom',
    end: 'top 10%',
    onUpdate: (self) => onFinaleProgress(self.progress),
  });
}

function revealLines(): void {
  gsap.utils.toArray<HTMLElement>('[data-reveal-lines]').forEach((element) => {
    SplitText.create(element, {
      type: 'lines',
      mask: 'lines',
      linesClass: 'split-line',
      autoSplit: true,
      onSplit: (split) =>
        gsap.from(split.lines, {
          yPercent: 110,
          duration: 1.1,
          stagger: 0.08,
          ease: 'expo.out',
          scrollTrigger: { trigger: element, start: 'top 85%', once: true },
        }),
    });
  });
}

function revealWords(): void {
  gsap.utils.toArray<HTMLElement>('[data-reveal-words]').forEach((element) => {
    SplitText.create(element, {
      type: 'words',
      autoSplit: true,
      onSplit: (split) =>
        gsap.from(split.words, {
          opacity: 0.15,
          stagger: 0.1,
          ease: 'none',
          scrollTrigger: { trigger: element, start: 'top 75%', end: 'bottom 45%', scrub: true },
        }),
    });
  });
}

function revealFades(): void {
  gsap.utils.toArray<HTMLElement>('[data-reveal-fade]').forEach((element) => {
    gsap.from(element, {
      y: 40,
      opacity: 0,
      duration: 1,
      ease: 'expo.out',
      scrollTrigger: { trigger: element, start: 'top 90%', once: true },
    });
  });
}

function revealVisual(visual: HTMLElement, scrollTrigger: ScrollTrigger.Vars, delay = 0): void {
  gsap.from(visual, { clipPath: CLIP_HIDDEN, duration: 1.2, delay, ease: 'expo.out', scrollTrigger });
}

function pinWork(): (() => void) | undefined {
  const section = document.querySelector<HTMLElement>('[data-work]');
  const track = document.querySelector<HTMLElement>('[data-work-track]');
  if (!section || !track) return undefined;

  document.documentElement.classList.add(HORIZONTAL_CLASS);
  const distance = (): number => Math.max(0, track.scrollWidth - document.documentElement.clientWidth);
  const slide = gsap.to(track, {
    x: () => -distance(),
    ease: 'none',
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: () => `+=${distance()}`,
      pin: true,
      scrub: 1,
      invalidateOnRefresh: true,
      // Refreshed first so triggers below the pin include its spacing, whatever order they were created in.
      refreshPriority: 1,
    },
  });

  // Cards already on screen when the pin starts never cross a containerAnimation start, so they reveal on entry.
  const viewportWidth = document.documentElement.clientWidth;
  gsap.utils.toArray<HTMLElement>('[data-card-visual]').forEach((visual, index) => {
    if (visual.offsetLeft + track.offsetLeft < viewportWidth) {
      revealVisual(visual, { trigger: section, start: 'top 60%', once: true }, index * 0.15);
      return;
    }
    revealVisual(visual, { trigger: visual, containerAnimation: slide, start: 'left 90%', once: true });
  });

  return () => document.documentElement.classList.remove(HORIZONTAL_CLASS);
}

function revealCardsStacked(): void {
  gsap.utils.toArray<HTMLElement>('[data-card-visual]').forEach((visual) => {
    revealVisual(visual, { trigger: visual, start: 'top 90%', once: true });
  });
}

export function initMotion(options: MotionOptions): () => void {
  gsap.registerPlugin(ScrollTrigger, SplitText);
  const media = gsap.matchMedia();

  media.add(FULL_MOTION, () => {
    const stopSmoothScroll = startSmoothScroll();
    trackJourney(options);
    revealLines();
    revealWords();
    revealFades();
    return stopSmoothScroll;
  });
  media.add(`${FULL_MOTION} and ${HORIZONTAL}`, pinWork);
  media.add(STACKED, revealCardsStacked);
  media.add(REDUCED_MOTION, () => {
    options.onHeroProgress(0);
    options.onJourneyProgress(0);
    options.onFinaleProgress(0);
  });

  return () => media.revert();
}
