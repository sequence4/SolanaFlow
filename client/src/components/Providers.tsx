"use client";
// @ts-nocheck


import WalletConnectionProvider from "@/context/WalletConnectionProvider";
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
          <WalletConnectionProvider>
            <AuthProvider>
              <ProjectProvider>
                <TaskLogsProvider>
                  <FileContextProvider>
                    {children}
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