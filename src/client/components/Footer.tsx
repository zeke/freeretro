import { Link } from "react-router-dom";

function GitHubIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 fill-current">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.65 7.65 0 0 1 8 3.86c.68.003 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

function CloudflareIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 28" className="h-4 w-7 fill-current">
      <path d="M36.2 11.2c-.7-5.4-5.3-9.6-10.9-9.6-4.7 0-8.8 3-10.4 7.3-.8-.3-1.7-.5-2.6-.5-4.1 0-7.4 3.3-7.4 7.4 0 .5.1 1 .2 1.5C2.2 18.1 0 20.8 0 24h36.1c3.5 0 6.4-2.9 6.4-6.4s-2.8-6.3-6.3-6.4Z" />
      <path d="M41.5 24H48c0-3.2-2.2-5.9-5.1-6.7v.3c0 2.7-1.3 5-3.4 6.4h2Z" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="text-cf-text-muted flex flex-wrap items-center justify-center gap-3 px-6 py-6 text-sm">
      <span className="inline-flex items-center gap-1.5">
        <CloudflareIcon />
        Sponsored by Cloudflare
      </span>
      <span aria-hidden="true">/</span>
      <a
        href="https://github.com/zeke/freeretro"
        className="hover:text-cf-orange inline-flex items-center gap-1.5 transition-colors"
      >
        <GitHubIcon />
        Open source on GitHub
      </a>
      <span aria-hidden="true">/</span>
      <Link to="/about" className="hover:text-cf-orange transition-colors">
        What is this?
      </Link>
    </footer>
  );
}
