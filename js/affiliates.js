const HERO_AFFILIATE_AUTOPLAY_MS = 6400;
const HERO_AFFILIATE_SLIDES = [
  {
    href: 'https://chatllm.abacus.ai/zkZsXzHxKD',
    ariaLabel: 'Open AbacusAI ChatLLM affiliate link',
    eyebrow: 'Affiliate',
    title: 'AbacusAI / ChatLLM',
    copy: 'One place for ChatGPT, Claude, Gemini and other models without bouncing between tabs.',
    cta: 'Open ChatLLM ↗',
    badge: 'AI tools'
  },
  {
    href: 'https://www.trading212.com/invite/Hr6ADcl7',
    ariaLabel: 'Open Trading212 invite link',
    eyebrow: 'Invite link',
    title: 'Trading212',
    copy: 'A simple investing app for stocks, ETFs and fractional shares, with Nico’s invite link.',
    cta: 'Open invite ↗',
    badge: 'Investing',
    cardClass: 'hero-affiliate-card--trading212'
  }
];

let heroAffiliateInterval = null;

export function stopHeroAffiliates() {
  if (heroAffiliateInterval) {
    clearInterval(heroAffiliateInterval);
    heroAffiliateInterval = null;
  }
}

export function initHeroAffiliates(options = {}) {
  const root = document.getElementById(options.rootId || 'heroAffiliates');
  const viewport = document.getElementById(options.viewportId || 'heroAffiliatesViewport');
  const pagination = document.getElementById(options.paginationId || 'heroAffiliatesPagination');

  if (!root || !viewport || !pagination) return;

  const slideCount = HERO_AFFILIATE_SLIDES.length;
  const hasLoop = slideCount > 1;
  const renderedSlides = hasLoop
    ? [
        { ...HERO_AFFILIATE_SLIDES[slideCount - 1], realIndex: slideCount - 1, isClone: true },
        ...HERO_AFFILIATE_SLIDES.map((slide, index) => ({ ...slide, realIndex: index })),
        { ...HERO_AFFILIATE_SLIDES[0], realIndex: 0, isClone: true }
      ]
    : HERO_AFFILIATE_SLIDES.map((slide, index) => ({ ...slide, realIndex: index }));

  viewport.innerHTML = renderedSlides.map((slide, index) => `
    <a
      href="${slide.href}"
      target="_blank"
      rel="noopener noreferrer"
      draggable="false"
      class="hero-affiliate-card ${slide.cardClass || ''}${slide.isClone ? ' hero-affiliate-card--clone' : ''}"
      aria-label="${slide.ariaLabel}"
      data-index="${index}"
      data-real-index="${slide.realIndex}"
      ${slide.isClone ? 'data-clone="true"' : ''}
    >
      <div class="hero-affiliate-card__top">
        <span class="hero-affiliate-card__eyebrow">${slide.eyebrow}</span>
        <span class="hero-affiliate-card__badge">${slide.badge}</span>
      </div>
      <div class="hero-affiliate-card__body">
        <span class="hero-affiliate-card__title">${slide.title}</span>
        <span class="hero-affiliate-card__copy">${slide.copy}</span>
      </div>
      <div class="hero-affiliate-card__footer">
        <span class="hero-affiliate-card__cta">${slide.cta}</span>
        <span class="hero-affiliate-card__note">${slide.realIndex + 1}/${slideCount}</span>
      </div>
    </a>
  `).join('');

  pagination.innerHTML = HERO_AFFILIATE_SLIDES.map((_, index) => `
    <span class="hero-affiliates__dot${index === 0 ? ' is-active' : ''}"></span>
  `).join('');

  const slides = Array.from(viewport.querySelectorAll('.hero-affiliate-card'));
  const dots = Array.from(pagination.querySelectorAll('.hero-affiliates__dot'));
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const firstRenderedIndex = hasLoop ? 1 : 0;
  const lastRenderedIndex = hasLoop ? slideCount : slideCount - 1;
  const leadingCloneIndex = hasLoop ? 0 : -1;
  const trailingCloneIndex = hasLoop ? slides.length - 1 : -1;
  const lastRealIndex = slideCount - 1;

  let currentRenderedIndex = firstRenderedIndex;
  let scrollSyncFrame = null;
  let loopResetTimeout = null;
  let loopResetScrollEndHandler = null;
  let pendingLoopTargetRealIndex = null;
  let isLoopResetting = false;
  let autoplayResumeQueued = false;
  let dragPointerId = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartScrollLeft = 0;
  let dragStartRenderedIndex = firstRenderedIndex;
  let dragDirection = null;
  let dragMoved = false;

  const clearLoopReset = () => {
    if (loopResetTimeout) {
      clearTimeout(loopResetTimeout);
      loopResetTimeout = null;
    }

    if (loopResetScrollEndHandler) {
      viewport.removeEventListener('scrollend', loopResetScrollEndHandler);
      loopResetScrollEndHandler = null;
    }
  };

  const withInstantReset = (callback) => {
    viewport.classList.add('is-resetting');
    callback();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        viewport.classList.remove('is-resetting');
      });
    });
  };

  const updateActiveState = (renderedIndex) => {
    const safeRenderedIndex = Math.max(0, Math.min(slides.length - 1, renderedIndex));
    const activeSlide = slides[safeRenderedIndex];
    const activeRealIndex = Number(activeSlide?.dataset.realIndex ?? 0);

    currentRenderedIndex = safeRenderedIndex;

    dots.forEach((dot, dotIndex) => {
      dot.classList.toggle('is-active', dotIndex === activeRealIndex);
    });

    slides.forEach((slide, slideIndex) => {
      const active = slideIndex === safeRenderedIndex;
      slide.setAttribute('aria-current', active ? 'true' : 'false');
      slide.tabIndex = active ? 0 : -1;
    });
  };

  const getNearestRenderedIndex = () => {
    if (!slides.length) return firstRenderedIndex;

    let nearestIndex = firstRenderedIndex;
    let nearestDistance = Number.POSITIVE_INFINITY;

    slides.forEach((slide, index) => {
      const distance = Math.abs(viewport.scrollLeft - slide.offsetLeft);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    return nearestIndex;
  };

  const goToRenderedIndex = (renderedIndex, behavior = 'smooth') => {
    const targetIndex = Math.max(0, Math.min(slides.length - 1, renderedIndex));
    const targetSlide = slides[targetIndex];
    if (!targetSlide) return;

    viewport.scrollTo({
      left: targetSlide.offsetLeft,
      behavior: prefersReducedMotion ? 'auto' : behavior
    });
    updateActiveState(targetIndex);
  };

  const getRenderedIndexForReal = (realIndex) => {
    const normalized = ((realIndex % slideCount) + slideCount) % slideCount;
    return hasLoop ? normalized + 1 : normalized;
  };

  const finishLoopReset = () => {
    if (!isLoopResetting || pendingLoopTargetRealIndex === null) return;

    const targetRealIndex = pendingLoopTargetRealIndex;
    clearLoopReset();
    pendingLoopTargetRealIndex = null;
    isLoopResetting = false;

    withInstantReset(() => {
      goToRenderedIndex(getRenderedIndexForReal(targetRealIndex), 'auto');
    });

    if (autoplayResumeQueued) {
      autoplayResumeQueued = false;
      startAutoplay();
    }
  };

  const scheduleLoopReset = (targetRealIndex) => {
    if (!hasLoop) return;

    clearLoopReset();
    pendingLoopTargetRealIndex = targetRealIndex;
    isLoopResetting = true;

    loopResetScrollEndHandler = () => {
      finishLoopReset();
    };

    viewport.addEventListener('scrollend', loopResetScrollEndHandler, { once: true });
    loopResetTimeout = window.setTimeout(finishLoopReset, prefersReducedMotion ? 0 : 460);
  };

  const cancelLoopReset = ({ resolvePending = false } = {}) => {
    if (resolvePending && isLoopResetting) {
      finishLoopReset();
      return;
    }

    clearLoopReset();
    pendingLoopTargetRealIndex = null;
    isLoopResetting = false;
    autoplayResumeQueued = false;
  };

  const goToNext = (behavior = 'smooth', fromRenderedIndex = currentRenderedIndex) => {
    if (hasLoop && fromRenderedIndex >= lastRenderedIndex) {
      goToRenderedIndex(trailingCloneIndex, behavior);
      scheduleLoopReset(0);
      return;
    }

    goToRenderedIndex(Math.min(lastRenderedIndex, fromRenderedIndex + 1), behavior);
  };

  const goToPrevious = (behavior = 'smooth', fromRenderedIndex = currentRenderedIndex) => {
    if (hasLoop && fromRenderedIndex <= firstRenderedIndex) {
      goToRenderedIndex(leadingCloneIndex, behavior);
      scheduleLoopReset(lastRealIndex);
      return;
    }

    cancelLoopReset();
    goToRenderedIndex(Math.max(firstRenderedIndex, fromRenderedIndex - 1), behavior);
  };

  const stopAutoplay = () => {
    stopHeroAffiliates();
  };

  const startAutoplay = () => {
    if (isLoopResetting) {
      autoplayResumeQueued = true;
      return;
    }

    autoplayResumeQueued = false;
    stopAutoplay();
    if (prefersReducedMotion || slideCount < 2) return;

    heroAffiliateInterval = window.setInterval(() => {
      goToNext();
    }, HERO_AFFILIATE_AUTOPLAY_MS);
  };

  viewport.addEventListener('scroll', () => {
    if (scrollSyncFrame) cancelAnimationFrame(scrollSyncFrame);
    scrollSyncFrame = requestAnimationFrame(() => {
      updateActiveState(getNearestRenderedIndex());
    });
  }, { passive: true });

  const resetDrag = () => {
    if (dragPointerId !== null) {
      viewport.releasePointerCapture?.(dragPointerId);
    }
    dragPointerId = null;
    dragDirection = null;
    dragMoved = false;
    viewport.classList.remove('is-pointer-down');
    viewport.classList.remove('is-dragging-x');
  };

  viewport.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    cancelLoopReset({ resolvePending: true });

    dragPointerId = event.pointerId;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragStartScrollLeft = viewport.scrollLeft;
    dragStartRenderedIndex = currentRenderedIndex;
    dragDirection = null;
    dragMoved = false;
    viewport.classList.add('is-pointer-down');
    stopAutoplay();
  });

  viewport.addEventListener('pointermove', (event) => {
    if (dragPointerId !== event.pointerId) return;

    const deltaX = event.clientX - dragStartX;
    const deltaY = event.clientY - dragStartY;

    if (!dragDirection) {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;
      dragDirection = Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y';
      if (dragDirection === 'x') {
        dragMoved = true;
        viewport.classList.add('is-dragging-x');
        viewport.setPointerCapture?.(event.pointerId);
      }
    }

    if (dragDirection !== 'x') return;

    event.preventDefault();
    dragMoved = true;
    viewport.scrollLeft = dragStartScrollLeft - deltaX;
  });

  viewport.addEventListener('pointerup', (event) => {
    if (dragPointerId !== event.pointerId) return;

    if (dragDirection === 'x') {
      const deltaX = event.clientX - dragStartX;
      const slideWidth = slides[0]?.getBoundingClientRect().width || viewport.clientWidth || 1;
      const threshold = Math.min(72, slideWidth * 0.18);

      if (deltaX <= -threshold) {
        goToNext('smooth', dragStartRenderedIndex);
      } else if (deltaX >= threshold) {
        goToPrevious('smooth', dragStartRenderedIndex);
      } else {
        cancelLoopReset();
        goToRenderedIndex(dragStartRenderedIndex);
      }
    }

    resetDrag();
    startAutoplay();
  });

  viewport.addEventListener('pointercancel', () => {
    cancelLoopReset();
    resetDrag();
    startAutoplay();
  });

  viewport.addEventListener('click', (event) => {
    if (dragMoved) {
      event.preventDefault();
      event.stopPropagation();
      resetDrag();
    }
  }, true);

  viewport.addEventListener('dragstart', (event) => {
    event.preventDefault();
  });

  root.addEventListener('mouseenter', stopAutoplay);
  root.addEventListener('mouseleave', startAutoplay);
  root.addEventListener('focusin', stopAutoplay);
  root.addEventListener('focusout', (event) => {
    if (!root.contains(event.relatedTarget)) startAutoplay();
  });

  updateActiveState(firstRenderedIndex);
  goToRenderedIndex(firstRenderedIndex, 'auto');
  startAutoplay();
}
