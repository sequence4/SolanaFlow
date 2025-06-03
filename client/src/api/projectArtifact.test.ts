import { downloadArtifact } from './projectArtifact';
import { API_URL } from '@/config/api';

// Mock the fetch function
global.fetch = jest.fn();

describe('downloadArtifact', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => 'mock-token'),
      },
      writable: true,
    });
  });

  it('fetches artifact with correct URL and headers', async () => {
    // Mock successful response
    const mockArrayBuffer = new ArrayBuffer(100);
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: jest.fn().mockResolvedValueOnce(mockArrayBuffer),
    });

    const projectId = 'test-project-id';
    const result = await downloadArtifact(projectId);

    // Verify fetch was called with correct parameters
    expect(fetch).toHaveBeenCalledWith(
      `${API_URL}/api/projects/${projectId}/artifact`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/octet-stream',
          Authorization: 'Bearer mock-token',
        },
        credentials: 'include',
      }
    );

    // Verify result
    expect(result).toBe(mockArrayBuffer);
  });

  it('throws error when response is not ok', async () => {
    // Mock error response
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const projectId = 'test-project-id';
    
    // Expect the function to throw an error
    await expect(downloadArtifact(projectId)).rejects.toThrow('HTTP 404 fetching artefact');
  });
}); 