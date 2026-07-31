"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/** Shape of the JSON the Mautic server posts back to the embedding page. */
type MauticResponse = {
  success?: unknown;
  successMessage?: string;
  validationErrors?: unknown;
};

type CallbackSlot = Record<string, ((data: MauticResponse) => unknown) | undefined>;
type MauticWindow = Window & {
  MauticFormCallback?: Record<string, CallbackSlot | undefined>;
};

/** CSS class the SDK adds to the wrapper once a submission succeeded. */
const SUCCESS_CLASS = "mauticform-post-success";

type UseCatalogDownloadOptions = {
  /** Mautic form alias — keys both the DOM ids and the callback registry. */
  formAlias: string;
  /** Same-origin URL of the PDF (must be same-origin for `download` to work). */
  fileUrl: string;
  /** Filename suggested to the browser. */
  fileName: string;
  /** Container holding the embedded form (used by the class-based fallback). */
  containerRef: RefObject<HTMLElement | null>;
};

/**
 * Starts the catalog PDF download as soon as the embedded Mautic form reports a
 * successful submission — so the visitor never leaves the page.
 *
 * Success is detected two independent ways, whichever fires first:
 *
 *  1. `window.MauticFormCallback[alias].onResponseEnd` — the SDK's documented
 *     hook, called with the parsed server response (`response.success`). Any
 *     previously registered handler is chained and restored on cleanup.
 *  2. The `mauticform-post-success` class the SDK adds to
 *     `#mauticform_wrapper_<alias>` — a DOM-level fallback that keeps working if
 *     the callback name changes in a future SDK version.
 *
 * The automatic download is fired once (`autoStarted`); the returned `download`
 * is unguarded so the success panel can offer a manual retry, which also covers
 * browsers that block a programmatic download outside a user gesture.
 */
export function useCatalogDownload({
  formAlias,
  fileUrl,
  fileName,
  containerRef,
}: UseCatalogDownloadOptions) {
  const [succeeded, setSucceeded] = useState(false);
  const autoStarted = useRef(false);

  const download = useCallback(() => {
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = fileName;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, [fileUrl, fileName]);

  const onSuccess = useCallback(() => {
    setSucceeded(true);
    if (autoStarted.current) return;
    autoStarted.current = true;
    download();
  }, [download]);

  useEffect(() => {
    const mauticWindow = window as MauticWindow;
    const registry = (mauticWindow.MauticFormCallback ??= {});
    const slot = (registry[formAlias] ??= {});
    const previous = slot.onResponseEnd;

    const handler = (response: MauticResponse) => {
      const result = previous?.(response);
      if (response?.success) onSuccess();
      return result;
    };
    slot.onResponseEnd = handler;

    // DOM fallback — only meaningful once the wrapper exists.
    const wrapper = containerRef.current?.querySelector(
      `#mauticform_wrapper_${formAlias}`,
    );
    let observer: MutationObserver | undefined;
    if (wrapper) {
      observer = new MutationObserver(() => {
        if (wrapper.classList.contains(SUCCESS_CLASS)) onSuccess();
      });
      observer.observe(wrapper, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }

    return () => {
      // Only unwind our own handler — a later mount may have replaced it.
      if (slot.onResponseEnd === handler) slot.onResponseEnd = previous;
      observer?.disconnect();
    };
  }, [formAlias, onSuccess, containerRef]);

  return { succeeded, download };
}
