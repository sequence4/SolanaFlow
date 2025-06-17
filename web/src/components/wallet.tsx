"use client";

import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletName } from "@solana/wallet-adapter-base";

export default function Wallet() {
  const { publicKey, connected, disconnect, connect, select, wallets } = useWallet();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const toggleDropdown = () => setIsDropdownOpen(!isDropdownOpen);
  const closeDropdown = () => setIsDropdownOpen(false);

  const handleConnect = (walletName: WalletName) => {
    select(walletName);
    connect().catch(console.error);
    closeDropdown();
  };

  const handleDisconnect = () => {
    disconnect().catch(console.error);
  };

  // Format address for display
  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <div className="relative">
      {connected && publicKey ? (
        <div className="flex items-center gap-2">
          <span className="text-xs bg-green-100 text-green-800 py-1 px-2 rounded-full">
            {formatAddress(publicKey.toString())}
          </span>
          <button
            onClick={handleDisconnect}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div>
          <button
            onClick={toggleDropdown}
            className="bg-purple-600 hover:bg-purple-700 text-white text-xs py-1 px-3 rounded-full"
          >
            Connect Wallet
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg z-10">
              <div className="py-1">
                {wallets.map((wallet) => (
                  <button
                    key={wallet.adapter.name}
                    onClick={() => handleConnect(wallet.adapter.name)}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {wallet.adapter.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 