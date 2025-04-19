import React, { useMemo } from "react";
import { type Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { type AppType } from "next/app";
import { Geist } from "next/font/google";
import { api } from "~/utils/api";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
import "@solana/wallet-adapter-react-ui/styles.css";
import "~/styles/globals.css";

import ProjectProvider from "~/context/project/ProjectContextProvider";
import FileContextProvider from "~/context/file/FileContextProvider";
import UxContextProvider from "~/context/ux/UxContextProvider";
import TaskLogsProvider from "~/context/logs/TaskLogsProvider";
import { Provider } from "~/components/ui/provider";
// import { Toaster } from "~/components/ui/sonner";

const geist = Geist({
  subsets: ["latin"],
});

const MyApp: AppType<{ session: Session | null }> = ({
  Component,
  pageProps: { session, ...pageProps },
}) => {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);
  return (
    <ConnectionProvider endpoint={endpoint}>
      <Provider>
        <ProjectProvider>
          <FileContextProvider>
            <UxContextProvider>
              <TaskLogsProvider>
                <WalletProvider wallets={wallets} autoConnect>
                  <WalletModalProvider>
                    <SessionProvider session={session}>
                      <div className={geist.className}>
                        <Component {...pageProps} />
                      </div>
                    </SessionProvider>
                  </WalletModalProvider>
                </WalletProvider>
              </TaskLogsProvider>
            </UxContextProvider>
          </FileContextProvider>
        </ProjectProvider>
      </Provider>
    </ConnectionProvider>
  );
};

export default api.withTRPC(MyApp);
