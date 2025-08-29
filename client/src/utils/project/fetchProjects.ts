import { projectApi } from "@/api/projectApi";
import { PROJECTS_PAGE_SIZE } from "./constants";

export const fetchProjects = async (
    page: number, 
    search: string, 
    setProjects: (projects: unknown[]) => void, 
    setTotalPages: (totalPages: number) => void, 
    setLoading: (loading: boolean) => void, 
    setError: (error: string | null) => void,
    limit = PROJECTS_PAGE_SIZE 
) => {
    setLoading(true);
    setError(null);

    try {
      const { data: list, totalPages } = 
        await projectApi.listProjects(page, limit, search);

      console.log('projects-list', list);
      console.log('totalPages', totalPages);

      // Guard against accidental "limit=0/1" regressions
      if (list.length === 1 && totalPages > 1) {
        console.warn(
          'Project list fetched only one item – check limit parameter in fetchProjects'
        );
      }

      setProjects(list);                 // safe: always an array now
      setTotalPages(totalPages);
    } catch {
      setError('Failed to load projects. Please try again.');
    } finally {
      setLoading(false);
    }
};