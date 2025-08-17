import { Button } from "@/components/ui/button"
import { useContext } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import UxContext from "@/context/ux/UxContext"
import FileContext from "@/context/file/FileContext"
import { ActiveTab } from "@/context/ux/UxContextTypes"
import { FileTreeItemType } from "@/interfaces/FileTreeItemType"

export function Header() {
  const { activeTab, setActiveTab } = useContext(UxContext)
  const { fileTree } = useContext(FileContext)
  const { connected, publicKey } = useWallet()

  // Check if files exist for enabling interface/code tabs
  const treeHasFile = (n: FileTreeItemType | FileTreeItemType[]): boolean =>
    Array.isArray(n)
      ? n.some(treeHasFile)
      : n.children && n.children.length > 0
        ? n.children.some(treeHasFile)
        : true

  const hasFiles = fileTree ? treeHasFile(fileTree) : false
  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6 shadow-sm">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-purple-600 rounded-lg flex items-center justify-center shadow-md">
            <span className="text-sm font-bold text-white font-heading">S</span>
          </div>
          <div className="flex flex-col">
            <span className="font-heading font-bold text-xl">SolanaFlow</span>
            <span className="text-xs text-muted-foreground">Visual Programming Interface</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
        <Button 
          variant={activeTab === "workflow" ? "default" : "ghost"}
          size="sm" 
          className={activeTab === "workflow" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"}
          onClick={() => setActiveTab("workflow")}
        >
          workflow
        </Button>
        <Button
          variant={activeTab === "interface" ? "default" : "ghost"}
          size="sm"
          className={activeTab === "interface" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"}
          disabled={!hasFiles}
          onClick={() => {
            if (hasFiles) {
              setActiveTab("interface")
            }
          }}
        >
          interface
        </Button>
        <Button
          variant={activeTab === "code" ? "default" : "ghost"}
          size="sm"
          className={activeTab === "code" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"}
          disabled={!hasFiles}
          onClick={() => {
            if (hasFiles) {
              setActiveTab("code")
            }
          }}
        >
          code
        </Button>
      </div>

      <div className="flex items-center gap-3">
        {connected && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-muted-foreground">
              {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
            </span>
          </div>
        )}
        {!connected && (
          <Button variant="outline" size="sm" className="shadow-sm hover:shadow-md transition-shadow bg-transparent">
            Connect Wallet
          </Button>
        )}
      </div>
    </header>
  )
}