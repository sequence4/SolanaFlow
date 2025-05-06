import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WaitlistForm from '@/components/WaitlistForm';
import { act } from 'react';

const fetchMock = jest.fn((url) => {
  if (url === '/api/csrf-token') {
    return Promise.resolve({
      status: 200,
      json: () => Promise.resolve({ token: 'fake-csrf-token' })
    });
  }
  return Promise.resolve({
    status: 201,
    json: () => Promise.resolve({})
  });
});
global.fetch = fetchMock as unknown as typeof fetch;

const VALID_WALLET = '6z7CD8WuEg3DKoaUYpoa5Dhx3XJRoXnUjYQeUo78noHH';

describe('WaitlistForm client-side validation', () => {
  beforeEach(() => {
    fetchMock.mockClear();
    document.body.style.overflow = '';
  });

  it.skip('shows error for invalid email', async () => {
    await act(async () => {
      render(<WaitlistForm />);
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'bad' },
      });
      fireEvent.click(screen.getByRole('button', { name: /join the list/i }));
    });
    
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalledWith('/api/waitlist', expect.anything());
  });

  it('allows submission with a valid wallet only', async () => {
    await act(async () => {
      render(<WaitlistForm />);
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/wallet/i), {
        target: { value: VALID_WALLET },
      });
      fireEvent.click(screen.getByRole('button', { name: /join the list/i }));
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/waitlist', expect.anything());
    });
  });

  it('aborts when the honeypot field is filled', async () => {
    await act(async () => {
      render(<WaitlistForm />);
    });

    fetchMock.mockClear();

    await act(async () => {
      const trap = screen.getByLabelText(/leave blank/i);
      fireEvent.change(trap, { target: { value: 'bot-says-hi' } });
      fireEvent.click(screen.getByRole('button', { name: /join the list/i }));
    });

    await new Promise((r) => setTimeout(r, 50));
    
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('enforces maxlength on wallet field (44)', async () => {
    await act(async () => {
      render(<WaitlistForm />);
    });

    const walletInput = screen.getByLabelText(/wallet/i);
    expect(walletInput).toHaveAttribute('maxLength', '44');
  });
}); 