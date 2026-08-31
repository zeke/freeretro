import { DurableObject } from "cloudflare:workers";
import type { Env } from "./env.d";
import type { RetroSummary } from "./types";

// Turns a retro title and creation date into a readable URL slug, e.g.
// "Sprint 42 Retro" created on 2026-08-17 -> "sprint-42-retro-2026-08-17".
// The slug is generated once at creation and never changes, even if the
// retro is later renamed.
function slugify(title: string, createdAt: number): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
      .replace(/-+$/g, "") || "retro";
  const date = new Date(createdAt).toISOString().slice(0, 10);
  // Titles sometimes already end with a date (e.g. imported retros named
  // "DevRel Retro 2026-08-31"); don't tack on a duplicate.
  return base.endsWith(date) ? base : `${base}-${date}`;
}

export class RetroRegistry extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS retros (
          id TEXT PRIMARY KEY,
          slug TEXT,
          title TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          created_by TEXT
        )
      `);
      // Backfill slug column for tables created before it existed.
      const columns = [...this.ctx.storage.sql.exec<{ name: string }>("PRAGMA table_info(retros)")];
      if (!columns.some((column) => column.name === "slug")) {
        this.ctx.storage.sql.exec("ALTER TABLE retros ADD COLUMN slug TEXT");
      }
    });
  }

  private slugExists(slug: string): boolean {
    const cursor = this.ctx.storage.sql.exec("SELECT 1 FROM retros WHERE slug = ?", slug);
    return [...cursor].length > 0;
  }

  private generateUniqueSlug(title: string, createdAt: number): string {
    const base = slugify(title, createdAt);
    if (!this.slugExists(base)) return base;

    let suffix = 2;
    while (this.slugExists(`${base}-${suffix}`)) {
      suffix += 1;
    }
    return `${base}-${suffix}`;
  }

  async createRetro(id: string, title: string, createdBy: string | null): Promise<RetroSummary> {
    const createdAt = Date.now();
    const slug = this.generateUniqueSlug(title, createdAt);
    this.ctx.storage.sql.exec(
      "INSERT INTO retros (id, slug, title, created_at, created_by) VALUES (?, ?, ?, ?, ?)",
      id,
      slug,
      title,
      createdAt,
      createdBy,
    );
    return { id, slug, title, createdAt, createdBy };
  }

  async getRetro(idOrSlug: string): Promise<RetroSummary | null> {
    const cursor = this.ctx.storage.sql.exec<{
      id: string;
      slug: string | null;
      title: string;
      created_at: number;
      created_by: string | null;
    }>(
      "SELECT id, slug, title, created_at, created_by FROM retros WHERE id = ? OR slug = ?",
      idOrSlug,
      idOrSlug,
    );

    const row = [...cursor][0];
    if (!row) return null;
    return {
      id: row.id,
      slug: row.slug ?? row.id,
      title: row.title,
      createdAt: row.created_at,
      createdBy: row.created_by,
    };
  }

  async updateRetroTitle(id: string, title: string): Promise<RetroSummary | null> {
    this.ctx.storage.sql.exec("UPDATE retros SET title = ? WHERE id = ?", title, id);
    return this.getRetro(id);
  }

  async deleteRetro(id: string): Promise<void> {
    this.ctx.storage.sql.exec("DELETE FROM retros WHERE id = ?", id);
  }
}
