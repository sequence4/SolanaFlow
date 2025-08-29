import React from 'react';
import { FiCopy, FiExternalLink } from 'react-icons/fi';
import { cn } from '@/lib/utils';
import { darkTheme } from '@/styles/theme';

interface SolanaAccount {
  id: string;
  address: string;
  balance: string;
  type: string;
  status: 'active' | 'pending' | 'inactive';
}

interface AccountsBoxProps {
  accounts?: SolanaAccount[];
}

const dummyAccounts: SolanaAccount[] = [
  {
    id: '1',
    address: 'GkUL2xVqezKCM8rHmXSJyGbFmxRPg98Lk3c5JgG7KxZ',
    balance: '1000 SOL',
    type: 'Token Account',
    status: 'active',
  },
  {
    id: '2',
    address: 'Hj9KpWsVBhfxjYqkQJ1MhkVZx9uX7hVz6QV5iNBMbTn',
    balance: '500 SOL',
    type: 'Token Account',
    status: 'inactive',
  },
];

function getStatusColors(status: SolanaAccount['status']) {
  switch (status) {
    case 'active':
      return { bg: 'bg-green-600', text: 'text-white' };
    case 'pending':
      return { bg: 'bg-yellow-500', text: 'text-black' };
    case 'inactive':
    default:
      return { bg: 'bg-gray-500', text: 'text-white' };
  }
}

export const AccountsBox: React.FC<AccountsBoxProps> = ({ accounts = dummyAccounts }) => {
  return (
    <div 
      className="border rounded-xl w-[320px] shadow-2xl backdrop-blur-xl p-4"
      style={{
        backgroundColor: darkTheme.background.secondary,
        borderColor: darkTheme.border.default,
        backdropFilter: `blur(${darkTheme.glass.blur})`,
      }}
    >
      <div
        className="pb-3 border-b mb-3"
        style={{ borderColor: darkTheme.border.default }}
      >
        <div className="flex items-center justify-between">
          <span 
            className="text-sm font-medium"
            style={{ color: darkTheme.text.primary }}
          >
            Solana Accounts
          </span>

          <span
            className="text-[0.7rem] px-2 py-0.5 rounded-full border"
            style={{
              backgroundColor: darkTheme.background.tertiary,
              color: darkTheme.accent.cyan,
              borderColor: `${darkTheme.accent.cyan}30`,
            }}
          >
            {accounts.length} Active
          </span>
        </div>
      </div>

      {accounts.map((account, idx) => {
        const statusColors = getStatusColors(account.status);

        return (
          <div key={account.id}>
            {idx > 0 && (
              <div 
                className="border-t my-3" 
                style={{ borderColor: darkTheme.border.default }}
              />
            )}
            <div
              className="p-3 rounded-lg transition-colors duration-200"
              style={{
                backgroundColor: 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = darkTheme.background.tertiary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-[6px] h-[6px] rounded-full" 
                    style={{ backgroundColor: darkTheme.accent.cyan }}
                  />
                  <span 
                    className="text-sm font-medium"
                    style={{ color: darkTheme.text.primary }}
                  >
                    Account #{account.id}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    aria-label="Copy address"
                    className="p-1 rounded transition-colors"
                    style={{ color: darkTheme.text.secondary }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = darkTheme.text.primary;
                      e.currentTarget.style.backgroundColor = darkTheme.background.tertiary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = darkTheme.text.secondary;
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    title="Copy address"
                  >
                    <FiCopy size={14} />
                  </button>
                  <button
                    aria-label="View on Explorer"
                    className="p-1 rounded transition-colors"
                    style={{ color: darkTheme.text.secondary }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = darkTheme.text.primary;
                      e.currentTarget.style.backgroundColor = darkTheme.background.tertiary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = darkTheme.text.secondary;
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    title="View on Explorer"
                  >
                    <FiExternalLink size={14} />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs mb-1">
                <span style={{ color: darkTheme.text.secondary }}>Address</span>
                <span 
                  className="font-mono max-w-[160px] truncate"
                  style={{ color: darkTheme.text.primary }}
                >
                  {account.address}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span style={{ color: darkTheme.text.secondary }}>Balance</span>
                <span style={{ color: darkTheme.text.primary }}>{account.balance}</span>
              </div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span style={{ color: darkTheme.text.secondary }}>Type</span>
                <span style={{ color: darkTheme.text.primary }}>{account.type}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: darkTheme.text.secondary }}>Status</span>
                <span
                  className="text-[0.65rem] px-1.5 py-0.5 rounded-full border"
                  style={{
                    backgroundColor: account.status === 'active' ? darkTheme.accent.green : 
                                   account.status === 'pending' ? darkTheme.accent.blue :
                                   darkTheme.background.tertiary,
                    color: darkTheme.text.primary,
                    borderColor: account.status === 'active' ? `${darkTheme.accent.green}30` : 
                               account.status === 'pending' ? `${darkTheme.accent.blue}30` :
                               darkTheme.border.default,
                  }}
                >
                  {account.status}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}; 