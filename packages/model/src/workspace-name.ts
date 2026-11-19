// What to call a workspace (as DSH does, dsh-client-ui-workspace `workspaceDisplayTitle`): the first-use workspace
// keeps the automatic title `default-workspace`, which DSH shows in the member's language; any other title is the
// member's own. Only the title is read, never a path.
export const DSH_DEFAULT_WORKSPACE_TITLE = 'default-workspace';
export const workspaceName = (title: string | undefined, localizedDefault: string): string =>
  !title || title === DSH_DEFAULT_WORKSPACE_TITLE ? localizedDefault : title;
