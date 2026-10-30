/**
 * Tiptap Markdown is currently beta. Keep unsupported legacy structures in
 * a literal source editor rather than rewriting them on the next save.
 * This deliberately errs toward protecting the user's original bytes.
 */
export function requiresRawScratchpadEditing(value: string): boolean {
  return /(?:^|\n)\s*\|.+\|\s*(?:\n|$)|(?:^|\n)\s*\$\$|(?:^|\n)---\s*\n\w[^\n]*:\s|<\/?[a-z][^>]*>|!\[[^\]]*\]\([^)]*\)|\[[^\]]+\]:\s*\S+/im.test(value);
}
