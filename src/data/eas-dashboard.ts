/**
 * Links from the on-device debug menu out to this app's EAS dashboard.
 *
 * The URLs are built from the app config rather than hardcoded, so the screen
 * keeps pointing at the right project when the account or slug changes. Two
 * shapes exist: the account/slug path the EAS CLI prints, and the
 * `/projects/<id>` redirect, which survives an account or slug rename. We
 * prefer the readable one and fall back to the durable one.
 */

const EXPO_DASHBOARD_ORIGIN = "https://expo.dev";

export type EasProjectIdentity = {
  /** `expo.owner` — the account that owns the project. */
  owner?: string | null;
  /** `expo.slug` — the project name within that account. */
  slug?: string | null;
  /** `expo.extra.eas.projectId` — the stable project UUID. */
  projectId?: string | null;
};

/**
 * The dashboard URL for a page of this project, or null when the app config
 * carries neither an owner/slug pair nor a project ID (an unlinked project —
 * there is no dashboard to open).
 *
 * `page` is a dashboard path segment ("builds", "updates", "observe"); omit it
 * for the project's home.
 */
export function easProjectUrl(identity: EasProjectIdentity, page?: string): string | null {
  const { owner, slug, projectId } = identity;
  const base =
    owner && slug
      ? `${EXPO_DASHBOARD_ORIGIN}/accounts/${encodeURIComponent(owner)}/projects/${encodeURIComponent(slug)}`
      : projectId
        ? `${EXPO_DASHBOARD_ORIGIN}/projects/${encodeURIComponent(projectId)}`
        : null;
  if (!base) {
    return null;
  }
  return page ? `${base}/${page}` : base;
}
