function pageShell(title: string, heading: string, message: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    height: 100%;
    background: #0f1117;
    color: #e6edf3;
    font-family: system-ui, -apple-system, sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
  }
  .card { max-width: 420px; padding: 2rem; }
  .logo { display: flex; justify-content: center; gap: 3px; margin-bottom: 1.25rem; }
  .logo span {
    width: 20px; height: 20px; border-radius: 4px; background: #4f8ef7;
  }
  .logo span:nth-child(2), .logo span:nth-child(3) { opacity: 0.6; }
  h1 { font-size: 1.15rem; font-weight: 700; margin-bottom: 0.5rem; }
  p { font-size: 0.875rem; color: #8b949e; line-height: 1.5; }
</style>
</head>
<body>
  <div class="card">
    <div class="logo"><span></span><span></span><span></span><span></span></div>
    <h1>${heading}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

export function renderSelfLoopPage(): string {
  return pageShell(
    'Nice try, WebSquared',
    'Caught you red handed, little prankster!',
    "WebSquared can't be proxied through itself, that would just load an endless copy of this page inside itself. Try browsing to a different site instead."
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  adult: 'adult content',
  gambling: 'gambling',
  malware: 'malicious or phishing sites',
};

export function renderContentFilterPage(category: string, hostname: string): string {
  const label = CATEGORY_LABELS[category] ?? 'this category';
  return pageShell(
    'Blocked by content filter, WebSquared',
    'This site is blocked',
    `${hostname} is blocked by your "Block ${label}" filter. Turn it off in Settings > Browsing if you didn't mean to block it.`
  );
}
