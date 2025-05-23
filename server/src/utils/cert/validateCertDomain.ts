export const isWorkspaceSubdomain = (host: string | undefined): boolean => {
    if (!host) return false;
    return /^[0-9]{4,5}\.ws\.solanaflow\.dev$/i.test(host);
  };