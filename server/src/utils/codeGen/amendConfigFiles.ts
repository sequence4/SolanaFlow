/*

import { getFileContent } from "src/controllers/fileController"

interface AmendResult {
  cargoStatus: string
  cargoTaskId: string
  anchorStatus: string
  anchorTaskId: string
}

*/

export const placeholder = () => {
  return "placeholder"
}

/*
export const amendConfigFiles = async (projectId: string): Promise<AmendResult> => {
  const cargoSrc = await getFileContent(projectId, "Cargo.toml")
  const cargoLines = cargoSrc.split("\n")
  const depHeader = cargoLines.findIndex(l => l.trim() === "[dependencies]")

  if (depHeader !== -1) {
    const filtered = cargoLines.filter((l, idx) => {
      if (idx <= depHeader) return true
      const t = l.trim()
      return !t.startsWith("anchor-lang") && !t.startsWith("anchor-spl")
    })
    filtered.splice(depHeader + 1, 0,
      'anchor-spl = "0.30.1"',
      'anchor-lang = { version = "0.30.1", features = ["init-if-needed"] }',
    )
    const newCargo = filtered.join("\n")
    const { taskId: cargoTaskId } = await fileApi.updateFile(projectId, "Cargo.toml", newCargo)
    const cargoStatus = (await pollTaskStatus3(cargoTaskId)).task.status

    const anchorSrc = await getFileContent(projectId, "Anchor.toml")
    let anchorLines = anchorSrc.split("\n").map(l =>
      l.trim() === "[programs.localnet]" ? "[programs.devnet]" : l,
    )

    let providerStart = anchorLines.findIndex(l => l.trim() === "[provider]")
    if (providerStart === -1) {
      anchorLines.push("", "[provider]", 'cluster = "Devnet"', "")
    } else {
      let providerEnd = anchorLines.length
      for (let i = providerStart + 1; i < anchorLines.length; i++) {
        if (/^\[.*\]/.test(anchorLines[i].trim())) {
          providerEnd = i
          break
        }
      }
      const hasCluster = anchorLines
        .slice(providerStart + 1, providerEnd)
        .some(l => l.trim().startsWith("cluster ="))
      if (!hasCluster) {
        anchorLines.splice(providerStart + 1, 0, 'cluster = "Devnet"')
      } else {
        for (let i = providerStart + 1; i < providerEnd; i++) {
          if (anchorLines[i].trim().startsWith("cluster =")) {
            anchorLines[i] = 'cluster = "Devnet"'
          }
        }
      }
    }

    const newAnchor = anchorLines.join("\n")
    const { taskId: anchorTaskId } = await fileApi.updateFile(projectId, "Anchor.toml", newAnchor)
    const anchorStatus = (await pollTaskStatus3(anchorTaskId)).task.status

    return { cargoStatus, cargoTaskId, anchorStatus, anchorTaskId }
  }

  const { taskId: anchorTaskId } = await fileApi.updateFile(projectId, "Anchor.toml", anchorSrc)
  const anchorStatus = (await pollTaskStatus3(anchorTaskId)).task.status
  return { cargoStatus: "failed", cargoTaskId: "", anchorStatus, anchorTaskId }
}
*/