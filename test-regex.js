const raw = "What is an identity matrix?\n\na) \\(\\begin{bmatrix} 1 & 0 \\ 0 & 1 \\end{bmatrix}\\)\n\nWhich is zero?\n\\[ \\begin{bmatrix} 0 & 0 \\ 0 & 0 \\end{bmatrix} \\]";

// 1. Replace \( and \) with $
let fixed = raw.replace(/\\\(/g, '$').replace(/\\\)/g, '$');
// 2. Replace \[ and \] with $$
fixed = fixed.replace(/\\\[/g, '$$$').replace(/\\\]/g, '$$$'); // note: $$$ in JS replace is $ followed by $

// 3. Fix single backslash inside matrices
// Find blocks of \begin{...} ... \end{...}
fixed = fixed.replace(/\\begin\{([a-zA-Z]+)\}([\s\S]*?)\\end\{\1\}/g, (match, type, content) => {
    // Replace single backslash (not followed by another backslash or a letter) with double backslash
    // Actually, often it's just " \ " instead of " \\ "
    let fixedContent = content.replace(/(?<!\\)\\(?!\\|[a-zA-Z])/g, '\\\\');
    return `\\begin{${type}}${fixedContent}\\end{${type}}`;
});

console.log(fixed);
