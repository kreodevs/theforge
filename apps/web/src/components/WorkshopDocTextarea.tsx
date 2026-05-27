import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type FocusEvent,
} from "react";

type WorkshopDocTextareaProps = Omit<
  ComponentPropsWithoutRef<"textarea">,
  "value" | "onChange"
> & {
  value: string;
  onChange: (value: string) => void;
};

/**
 * Textarea controlado que no aplica actualizaciones externas de `value` mientras tiene foco,
 * para que el autoguardado no mueva el cursor ni pise texto en curso.
 */
export function WorkshopDocTextarea({
  value,
  onChange,
  onFocus,
  onBlur,
  ...rest
}: WorkshopDocTextareaProps) {
  const [draft, setDraft] = useState(value);
  const focusedRef = useRef(false);
  const draftRef = useRef(value);
  const valueRef = useRef(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  valueRef.current = value;
  draftRef.current = draft;

  useEffect(() => {
    if (!focusedRef.current) {
      setDraft(value);
    }
  }, [value]);

  useLayoutEffect(() => {
    if (focusedRef.current) return;
    const el = textareaRef.current;
    if (!el) return;
    const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
    if (el.scrollTop > maxScroll) {
      el.scrollTop = maxScroll;
    }
  }, [draft, value]);

  const handleFocus = (e: FocusEvent<HTMLTextAreaElement>) => {
    focusedRef.current = true;
    onFocus?.(e);
  };

  const handleBlur = (e: FocusEvent<HTMLTextAreaElement>) => {
    focusedRef.current = false;
    const external = valueRef.current;
    if (external !== draftRef.current) {
      setDraft(external);
    }
    onBlur?.(e);
  };

  return (
    <textarea
      ref={textareaRef}
      {...rest}
      value={draft}
      onChange={(e) => {
        const next = e.target.value;
        setDraft(next);
        onChange(next);
      }}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  );
}
