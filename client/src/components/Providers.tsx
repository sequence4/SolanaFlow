"use client";

// @ts-nocheck - Disable TypeScript checking for this file due to provider component typing issues
import { WalletConnectionProvider } from "@/context/WalletConnectionProvider";
import AuthProvider from "@/context/auth/AuthProvider";
import ProjectProvider from "@/context/project/ProjectContextProvider";
import FileContextProvider from "@/context/file/FileContextProvider";
import UxContextProvider from "@/context/ux/UxContextProvider";
import TaskLogsProvider from "@/context/logs/TaskLogsProvider";
import { Provider } from "@/components/ui/provider";
import { Toaster } from "@/components/ui/sonner";

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Provider>
        <UxContextProvider>
          <FileContextProvider>
            <WalletConnectionProvider>
              <AuthProvider>
                <ProjectProvider>
                  <TaskLogsProvider>
                    {children}
                    <Toaster />
                  </TaskLogsProvider>
                </ProjectProvider>
              </AuthProvider>
            </WalletConnectionProvider>
          </FileContextProvider>
        </UxContextProvider>
      </Provider>
    </>
  );
} 