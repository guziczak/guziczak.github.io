/** Let the CV reflow at the available width, while the parent page owns scrolling. */
export function observeCvFrame(
  frame: HTMLIFrameElement,
  wrapper: HTMLElement,
  printVariant = false,
): () => void {
  const doc = frame.contentDocument;
  if (!doc?.body) return () => {};
  if (printVariant) doc.documentElement.classList.add('cv-print-variant');
  frame.style.width = '100%';
  frame.style.transform = 'none';
  // Viewport-sized sections should follow the reading window, not their expanding iframe.
  doc.documentElement.style.setProperty(
    '--cv-viewport-height',
    window.innerHeight + 'px',
  );
  doc.documentElement.style.overflow = 'hidden';
  doc.documentElement.style.minHeight = '0';
  doc.body.style.overflow = 'hidden';
  doc.body.style.minHeight = '0';
  let pending = 0;
  let disposed = false;
  const measure = () => {
    pending = 0;
    if (disposed || frame.contentDocument !== doc) return;
    const height =
      Math.ceil(
        Math.max(
          doc.body.scrollHeight,
          doc.body.getBoundingClientRect().height,
        ),
      ) + 2;
    const value = height + 'px';
    if (frame.style.height !== value) frame.style.height = value;
    if (wrapper.style.height !== value) wrapper.style.height = value;
  };
  const schedule = () => {
    if (!disposed && !pending) pending = requestAnimationFrame(measure);
  };
  const observer = new ResizeObserver(schedule);
  observer.observe(doc.body);
  observer.observe(wrapper);
  doc.addEventListener('load', schedule, true);
  doc.fonts.addEventListener('loadingdone', schedule);
  // A newly opened background tab may defer animation frames indefinitely.
  // The document is already loaded here, so establish its full height now.
  void doc.fonts.ready.then(() => {
    measure();
    schedule();
  });
  measure();
  return () => {
    disposed = true;
    cancelAnimationFrame(pending);
    observer.disconnect();
    doc.removeEventListener('load', schedule, true);
    doc.fonts.removeEventListener('loadingdone', schedule);
  };
}
