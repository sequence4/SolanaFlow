import { CodeIcon, BoxIcon, ZapIcon, RefreshCwIcon, UsersIcon } from "lucide-react"

export default function FeatureListRefined() {
  return (
    <div className="relative py-1 font-lekton">
      <div className="absolute inset-0 opacity-5">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <pattern id="circuit" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M0 20h40M20 0v40" stroke="#4ade80" strokeWidth="0.5" fill="none" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#circuit)" />
        </svg>
      </div>

      <div className="relative z-10">
        {features.map((feature, index) => (
          <div key={index} className="group flex items-start gap-3 mb-3 relative">
            <div className="absolute -left-4 top-1 font-lekton text-[10px] text-teal-500/40 opacity-0 group-hover:opacity-100 transition-opacity">
              $&gt;
            </div>

            <div className="relative">
              <div className="h-5 w-5 flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-br from-teal-900/20 to-teal-700/10 rounded-sm"></div>
                <div className="relative z-10 text-teal-400">{feature.icon}</div>
              </div>
              {index < features.length - 1 && (
                <div className="absolute top-5 left-2.5 w-px h-3 bg-gradient-to-b from-teal-500/30 to-transparent"></div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-medium text-white flex items-center font-lekton">
                <span className="font-lekton text-[10px] text-teal-500/70 mr-1.5 tracking-wider">{`0x${index.toString(16)}`}</span>
                {feature.title}
              </h3>

              <p className="text-xs text-gray-400 leading-tight pl-1 border-l border-teal-900/30 ml-1 font-lekton">
                {feature.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const features = [
  {
    title: "AI Powered Development",
    description: "Turn ideas into secure Solana dApps with natural-language instructions.",
    icon: <CodeIcon className="h-3 w-3" />,
  },
  {
    title: "Visual Workflow Builder",
    description: "Drag-and-drop pre-audited Solana modules for fast, reliable builds.",
    icon: <BoxIcon className="h-3 w-3" />,
  },
  {
    title: "Instant Deployment",
    description: "Ship to devnet or mainnet in a single click.",
    icon: <ZapIcon className="h-3 w-3" />,
  },
  {
    title: "Live Iterations",
    description: "Update logic and push upgrades in real time.",
    icon: <RefreshCwIcon className="h-3 w-3" />,
  },
  {
    title: "Collaborative Workspace",
    description: "Real-time co-editing with built-in version control.",
    icon: <UsersIcon className="h-3 w-3" />,
  },
] 