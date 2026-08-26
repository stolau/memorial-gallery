// Renders free-typed info text (person bio, event description, collection info)
// as blank-line-separated paragraphs. Blank lines split <p> blocks; single
// newlines within a block are preserved via CSS `white-space: pre-line`.
// Text is rendered as plain children — never as HTML — so any markup stays
// literal. No-ops (renders nothing) for null/empty/whitespace-only input.
function Paragraphs({ text }: { text: string | null | undefined }) {
  const paragraphs = (text ?? "")
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);

  if (paragraphs.length === 0) return null;

  return (
    <>
      {paragraphs.map((paragraph, i) => (
        <p key={i} className="info-paragraph">
          {paragraph}
        </p>
      ))}
    </>
  );
}

export default Paragraphs;
