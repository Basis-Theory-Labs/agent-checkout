/** Plain text where `backticks` mark code, for the step explanations. */
export function Prose({ text, className }: { text: string; className?: string }) {
  return (
    <p className={className}>
      {text.split(/`([^`]+)`/g).map((part, index) =>
        index % 2 === 1 ? (
          <code key={index} className="rounded-[4px] bg-white/[0.06] px-1 py-px font-mono text-[0.88em] text-ink">
            {part}
          </code>
        ) : (
          part
        ),
      )}
    </p>
  );
}
