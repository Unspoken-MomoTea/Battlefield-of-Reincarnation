import { parseDependencies } from './dependencies.js';
import { parseTags } from './fields.js';

export function projectPublic(row) {
  return {
    id: row.id, slug: row.slug, name: row.name, summary: row.summary,
    tags: parseTags(row.tags), dependencies: parseDependencies(row.dependencies), category: row.category, has_cover: Boolean(row.cover_key),
    status: 'published', version: Number(row.published_version), owner_name: row.owner_name,
    created_at: Number(row.created_at), downloads_count: Number(row.downloads_count || 0),
    likes_count: Number(row.likes_count || 0), favorites_count: Number(row.favorites_count || 0),
    updated_at: Number(row.updated_at),
  };
}

export function projectOwn(row) {
  return {
    id: row.id, slug: row.slug, name: row.name, summary: row.summary,
    tags: parseTags(row.tags), dependencies: parseDependencies(row.dependencies), category: row.category, has_cover: Boolean(row.cover_key),
    status: row.status, latest_version: Number(row.latest_version),
    published_version: Number(row.published_version || 0), created_at: Number(row.created_at),
    downloads_count: Number(row.downloads_count || 0), likes_count: Number(row.likes_count || 0),
    favorites_count: Number(row.favorites_count || 0), updated_at: Number(row.updated_at),
    review_note: row.review_note || '',
  };
}

export function projectAdmin(row) {
  return {
    id: row.id, slug: row.slug, name: row.name, summary: row.summary,
    tags: parseTags(row.tags), dependencies: parseDependencies(row.dependencies), category: row.category, has_cover: Boolean(row.cover_key),
    project_status: row.status, latest_version: Number(row.latest_version),
    published_version: Number(row.published_version || 0), owner_name: row.owner_name,
    owner_discord_id: row.owner_discord_id, owner_is_banned: Number(row.owner_is_banned || 0), review_status: row.review_status,
    changelog: row.changelog || '', version_created_at: Number(row.version_created_at || 0),
    submitted_at: Number(row.submitted_at || 0), reviewed_at: Number(row.reviewed_at || 0),
    review_decision: row.review_decision || '', review_note: row.review_note || '',
    reviewer_name: row.reviewer_name || '', created_at: Number(row.created_at),
    downloads_count: Number(row.downloads_count || 0), likes_count: Number(row.likes_count || 0),
    favorites_count: Number(row.favorites_count || 0), updated_at: Number(row.updated_at),
  };
}
