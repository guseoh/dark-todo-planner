type AutoListResult = {
  value: string;
  cursor: number;
};

const getCurrentLine = (value: string, cursor: number) => {
  const lineStart = value.lastIndexOf("\n", cursor - 1) + 1;
  const lineEndIndex = value.indexOf("\n", cursor);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  return {
    lineStart,
    lineEnd,
    beforeCursor: value.slice(lineStart, cursor),
    afterCursor: value.slice(cursor, lineEnd),
  };
};

const getNextPrefix = (line: string) => {
  const checklistMatch = line.match(/^(\s*)-\s+\[[ xX]\]\s+\S/);
  if (checklistMatch) return `${checklistMatch[1]}- [ ] `;

  const bulletMatch = line.match(/^(\s*)([-*])\s+\S/);
  if (bulletMatch) return `${bulletMatch[1]}${bulletMatch[2]} `;

  const numberedMatch = line.match(/^(\s*)(\d+)\.\s+\S/);
  if (numberedMatch) return `${numberedMatch[1]}${Number(numberedMatch[2]) + 1}. `;

  return "";
};

const getEmptyListPrefixLength = (line: string, afterCursor: string) => {
  if (afterCursor.trim()) return 0;
  const emptyChecklist = line.match(/^(\s*-\s+\[[ xX]\]\s*)$/);
  if (emptyChecklist) return emptyChecklist[1].length;
  const emptyBullet = line.match(/^(\s*[-*]\s*)$/);
  if (emptyBullet) return emptyBullet[1].length;
  const emptyNumber = line.match(/^(\s*\d+\.\s*)$/);
  if (emptyNumber) return emptyNumber[1].length;
  return 0;
};

export const applyAutoListEnter = (value: string, selectionStart: number, selectionEnd: number): AutoListResult | null => {
  if (selectionStart !== selectionEnd) return null;

  const { lineStart, beforeCursor, afterCursor } = getCurrentLine(value, selectionStart);
  const emptyPrefixLength = getEmptyListPrefixLength(beforeCursor, afterCursor);
  if (emptyPrefixLength) {
    const nextValue = `${value.slice(0, lineStart)}${value.slice(selectionStart)}`;
    return { value: nextValue, cursor: lineStart };
  }

  const prefix = getNextPrefix(beforeCursor);
  if (!prefix) return null;

  const insertion = `\n${prefix}`;
  const nextValue = `${value.slice(0, selectionStart)}${insertion}${value.slice(selectionEnd)}`;
  return { value: nextValue, cursor: selectionStart + insertion.length };
};
