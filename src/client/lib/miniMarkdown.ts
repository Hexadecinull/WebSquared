// A small, dependency-free markdown parser for our own bundled docs; returns structured blocks/segments instead of an HTML string so the viewer never needs {@html} at all.

export type InlineSegment =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'code'; text: string }
  | { type: 'link'; text: string; href: string };

export type Block =
  | { type: 'heading'; level: number; segments: InlineSegment[] }
  | { type: 'paragraph'; segments: InlineSegment[] }
  | { type: 'list'; items: InlineSegment[][] }
  | { type: 'code-block'; text: string };

const INLINE_RE = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;

export function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(INLINE_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) segments.push({ type: 'text', text: text.slice(lastIndex, index) });
    if (match[1] !== undefined) segments.push({ type: 'code', text: match[1] });
    else if (match[2] !== undefined) segments.push({ type: 'bold', text: match[2] });
    else if (match[3] !== undefined) segments.push({ type: 'link', text: match[3], href: match[4] });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) segments.push({ type: 'text', text: text.slice(lastIndex) });
  return segments;
}

export function parseMarkdown(md: string): Block[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let currentList: InlineSegment[][] | null = null;
  let inCodeBlock = false;
  let codeLines: string[] = [];

  function closeList() {
    if (currentList) { blocks.push({ type: 'list', items: currentList }); currentList = null; }
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        blocks.push({ type: 'code-block', text: codeLines.join('\n') });
        codeLines = [];
        inCodeBlock = false;
      } else {
        closeList();
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) { codeLines.push(rawLine); continue; }

    if (!line.trim()) { closeList(); continue; }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      closeList();
      blocks.push({ type: 'heading', level: heading[1].length + 1, segments: parseInline(heading[2]) });
      continue;
    }

    const listItem = line.match(/^[-*]\s+(.*)$/);
    if (listItem) {
      if (!currentList) currentList = [];
      currentList.push(parseInline(listItem[1]));
      continue;
    }

    closeList();
    blocks.push({ type: 'paragraph', segments: parseInline(line) });
  }

  if (inCodeBlock) blocks.push({ type: 'code-block', text: codeLines.join('\n') });
  closeList();
  return blocks;
}
