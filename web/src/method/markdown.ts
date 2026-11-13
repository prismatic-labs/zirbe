function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(text: string): string {
  return escape(text)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

export function renderMarkdown(source: string): string {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length === 0) return;
    blocks.push(`<ul>${list.join("")}</ul>`);
    list = [];
  };
  for (const line of lines) {
    if (line.startsWith("### ")) {
      flush();
      blocks.push(`<h3>${inline(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      flush();
      blocks.push(`<h2>${inline(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      flush();
      blocks.push(`<h2>${inline(line.slice(2))}</h2>`);
    } else if (line.startsWith("- ")) {
      list.push(`<li>${inline(line.slice(2))}</li>`);
    } else if (line.trim() === "") {
      flush();
    } else {
      flush();
      blocks.push(`<p>${inline(line)}</p>`);
    }
  }
  flush();
  return blocks.join("");
}
