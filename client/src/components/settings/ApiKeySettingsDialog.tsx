import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ShieldCheck, Key, Loader2 } from 'lucide-react';
import { Provider, providerList } from '@/utils/providerList';

interface Props { open: boolean; onOpenChange: (o: boolean) => void; }

export const ApiKeySettingsDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState<Set<Provider>>(new Set());
  const [draft, setDraft] = useState<Record<Provider, string>>({} as any);

  /* ---------- load saved providers on open ---------- */
  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        const resp = await fetch('/user/api-keys');           // GET
        const list: Provider[] = await resp.json();
        setSaved(new Set(list));
      } finally { setLoading(false); }
    })();
  }, [open]);

  /* ---------- save one key ---------- */
  const saveKey = async (p: Provider) => {
    const key = draft[p];
    if (!key) { toast.error('API key required'); return; }
    try {
      await fetch(`/user/api-keys/${p}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key })
      });
      toast.success(`${p} key saved`);
      setSaved(prev => new Set(prev).add(p));
      setDraft(d => ({ ...d, [p]: '' }));          // clear input
    } catch (e) {
      toast.error('Failed to save key');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[420px]">
        <DialogHeader className="text-base font-medium flex gap-2 items-center">
          <ShieldCheck size={18}/> Manage AI Provider Keys
        </DialogHeader>

        {loading && <div className="flex items-center gap-2 text-sm">
          <Loader2 className="animate-spin" size={16}/> Loading…
        </div>}

        {!loading && providerList.map(p => (
          <div key={p} className="flex items-center gap-2 my-2">
            <span className="min-w-[90px] capitalize">{p}</span>
            <Input
              type="password"
              placeholder={saved.has(p) ? '•••••••' : 'Paste API key'}
              className="flex-1"
              value={draft[p] ?? ''}
              onChange={e => setDraft({ ...draft, [p]: e.target.value })}
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={!draft[p]}
              onClick={() => saveKey(p)}
            >
              <Key size={14} className="mr-1"/> Save
            </Button>
          </div>
        ))}
      </DialogContent>
    </Dialog>
  );
}; 