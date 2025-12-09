"use client";


import WalletConnectionProvider from "@/context/WalletConnectionProvider";
import AuthProvider from "@/context/auth/AuthProvider";
import ProjectProvider from "@/context/project/ProjectContextProvider";
import FileContextProvider from "@/context/file/FileContextProvider";
import UxContextProvider from "@/context/ux/UxContextProvider";
import TaskLogsProvider from "@/context/logs/TaskLogsProvider";
import { Provider } from "@/components/ui/provider";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from 'next-themes'

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Provider>
        <UxContextProvider>
          <WalletConnectionProvider>
            <AuthProvider>
              <ProjectProvider>
                <TaskLogsProvider>
                  <FileContextProvider>
                    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
                      {children}
                    </ThemeProvider>
                    <Toaster />
                  </FileContextProvider>
                </TaskLogsProvider>
              </ProjectProvider>
            </AuthProvider>
          </WalletConnectionProvider>
        </UxContextProvider>
      </Provider>
    </>
  );
} 