import { useContext, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs"
import Workflow from "~/components/main/workflow/Workflow"
import Interface from "~/components/main/interface/Interface"
import Code from "~/components/main/code/Code"
import UxContext from "~/context/ux/UxContext"
import FileContext from "~/context/file/FileContext"
import type { ActiveTab } from "~/context/ux/UxContextTypes"
import { Toolbox } from "~/components/main/toolbox/Toolbox"
import Chat from "~/components/main/chat/Chat"
import LayoutHeader from "~/components/main/LayoutHeader"
import TaskLogsToast from "~/components/logs/TaskLogsToast"
import useInitializeTaskLogger from "~/hooks/useInitializeTaskLogger"
import { Loader2 } from "lucide-react"
import Image from "next/image"
export default function MainPage() {
  const router = useRouter()
  const { activeTab, setActiveTab } = useContext(UxContext)
  const { fileTree } = useContext(FileContext)
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      router.push("/login")
    },
  })
console.log("session", session)
  const hasFiles = !!(fileTree && fileTree.children && fileTree.children.length > 0)

  useEffect(() => {
    if (!hasFiles && (activeTab === "interface" || activeTab === "code")) {
      setActiveTab("workflow")
    }
  }, [hasFiles, activeTab, setActiveTab])

  useInitializeTaskLogger()

  // Show nothing while checking authentication
  if (status === "loading") {
    return (  <div className="flex min-h-screen flex-col items-center justify-center bg-black">
      <div className="flex flex-col items-center space-y-6">
        <div className="flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-blue-500">
        <Image 
              src="/logo.png" 
              alt="Solana FlowCode" 
              width={40} 
              height={40} 
              className="rounded-md" 
            />
        </div>
        <h1 className="bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-2xl font-bold text-transparent">
          NexusAI
        </h1>
        <div className="flex items-center space-x-2">
          <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
          <p className="text-gray-400">Loading your session...</p>
        </div>
      </div>
    </div>) // Or a loading spinner
  }

  return (
    <div className="w-screen h-screen flex flex-col overflow-y-hidden">
      <LayoutHeader />

      <div className="flex flex-1 overflow-hidden">
        <Toolbox />

        <main className="w-full h-full flex-1 overflow-y-auto">
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              if ((value === "interface" || value === "code") && !hasFiles) {
                return
              }
              setActiveTab(value as ActiveTab)
            }}
            className="h-full w-full flex flex-col"
          >
            <div className="flex items-center justify-start w-full">
              <TabsList className="mx-4 my-2 px-1 bg-[#1e1e24] w-fit border border-gray-800 rounded-sm">
                <TabsTrigger
                  value="workflow"
                  className="
                    data-[state=active]:bg-[#4f46e5]
                    data-[state=active]:text-white
                    px-3 py-1 text-sm font-medium
                    hover:bg-[#2a2a2d]
                    rounded-sm
                    cursor-pointer
                  "
                >
                  workflow
                </TabsTrigger>

                <TabsTrigger
                  value="interface"
                  disabled={!hasFiles}
                  className="
                    data-[state=active]:bg-[#4f46e5]
                    data-[state=active]:text-white
                    px-3 py-1 text-sm font-medium
                    hover:bg-[#2a2a2d]
                    rounded-sm
                    cursor-pointer
                  "
                >
                  interface
                </TabsTrigger>

                <TabsTrigger
                  value="code"
                  disabled={!hasFiles}
                  className="
                    data-[state=active]:bg-[#4f46e5]
                    data-[state=active]:text-white
                    px-3 py-1 text-sm font-medium
                    hover:bg-[#2a2a2d]
                    rounded-sm
                  "
                >
                  code
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="workflow" className="flex-1 h-full overflow-auto">
              <Workflow />
            </TabsContent>

            <TabsContent value="interface" className="flex-1 h-full overflow-auto">
              <Interface />
            </TabsContent>

            <TabsContent value="code" className="flex-1 h-full overflow-auto">
              <Code />
            </TabsContent>
          </Tabs>
        </main>

        <Chat />
        <TaskLogsToast />
      </div>
    </div>
  )
}
export async function getServerSideProps() {
  return {
    props: {}, // disables static generation for this page
  };
}
