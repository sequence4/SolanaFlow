/*
import { execInContainer, installDependenciesInContainer } from "../containerFileUtils"
import * as tpl from "./frontendUITemplates"
import { createTarballBuffer } from "./tarUtils"

export async function genUi(
  workspace: string,
  nodes: { slug: string }[],
  schemas: Record<string, unknown>[] = [],
): Promise<string[]> {
  const commonFiles: Record<string, string> = {
    "src/components/theme-toggle.tsx": tpl.THEME_TOGGLE_TSX,
    "src/components/wallet.tsx": tpl.WALLET_TSX,
    "src/components/ui/button.tsx": tpl.BUTTON_TSX,
    "src/components/ui/input.tsx": tpl.INPUT_TSX,
    "src/components/ui/label.tsx": tpl.LABEL_TSX,
    "src/lib/utils.ts": tpl.UTILS_TS,
    "src/globals.css": tpl.GLOBALS_CSS,
    "tailwind.config.js": tpl.TAILWIND_CONFIG,
    "postcss.config.js": tpl.POSTCSS_CONFIG,
    "src/App.tsx": tpl.APP_FILE_CONTENT,
    "src/index.tsx": tpl.INDEX_TSX_CONTENT,
  }

  const dynamicFiles = Object.fromEntries(
    nodes.map((n) => [`src/components/${n.slug}-form.tsx`, tpl.MINT_FORM_TSX]),
  )

  const schemaFiles = Object.fromEntries(
    schemas.map((s) => [
      `ui/schema/${s.id ?? `schema-${Date.now()}`}.json`,
      JSON.stringify(s, null, 2),
    ]),
  )

  const tarBuf = createTarballBuffer({ ...commonFiles, ...dynamicFiles, ...schemaFiles })

  const { taskId: putTask } = await execInContainer(
    workspace,
    "mkdir -p src/components/ui src/pages src/lib ui/schema && tar -xC /workspace -",
    tarBuf,
    "app",
  )

  const deps = [
    "tailwindcss",
    "postcss",
    "autoprefixer",
    "tailwindcss-animate",
    "@radix-ui/react-label",
    "@radix-ui/react-slot",
    "class-variance-authority",
    "clsx",
    "tailwind-merge",
    "lucide-react",
    "@solana/wallet-adapter-base",
    "@solana/wallet-adapter-react",
    "@solana/wallet-adapter-react-ui",
    "@solana/wallet-adapter-phantom",
    "@solana/web3.js",
  ]
  const { taskId: depTask } = await installDependenciesInContainer(workspace, deps, "app", true)

  return [putTask, depTask].filter(Boolean) as string[]
}
*/

export const placeholder = () => {
  return "placeholder"
}