function cleanLLMMath(raw) {
  // 1. Replace \( ... \) with $ ... $
  let fixed = raw.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');
  // 2. Replace \[ ... \] with $$ ... $$
  // In JS replace, "$$" means a single $, so "$$$$" means "$$"
  fixed = fixed.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$$1$$$$');

  // 3. Fix single backslash newlines inside \begin{...} ... \end{...} environments
  // Commonly LLMs output "1 & 0 \ 0 & 1" instead of "1 & 0 \\ 0 & 1"
  fixed = fixed.replace(/\\begin\{([a-zA-Z]+)\}([\s\S]*?)\\end\{\1\}/g, (match, type, content) => {
    // Replace any \ that is NOT followed by another \ or a letter (like \alpha) with \\
    const fixedContent = content.replace(/(?<!\\)\\(?!\\|[a-zA-Z])/g, '\\\\');
    return `\\begin{${type}}${fixedContent}\\end{${type}}`;
  });

  return fixed;
}

const input = "What is an identity matrix?\n\na) \\(\\begin{bmatrix} 1 & 0 \\ 0 & 1 \\end{bmatrix}\\)\n\nWhich is zero?\n\\[ \\begin{bmatrix} 0 & 0 \\ 0 & 0 \\end{bmatrix} \\]";
console.log(cleanLLMMath(input));
