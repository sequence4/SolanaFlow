import { CodeIcon, BoxIcon, ZapIcon, RefreshCwIcon, UsersIcon } from "lucide-react"

export default function FeatureListRefined() {
  return (
    <div className="relative py-1 sm:py-2 md:py-3 font-lekton w-full">
      <div className="absolute inset-0 opacity-5">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <pattern id="circuit" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M0 20h40M20 0v40" stroke="#4ade80" strokeWidth="0.5" fill="none" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#circuit)" />
        </svg>
      </div>

      <div className="relative z-10 flex flex-col items-center w-full">
        {features.map((feature, index) => (
          <div key={index} className="w-full max-w-[80%] group flex flex-col sm:flex-row items-center text-center sm:text-left sm:items-start gap-4 sm:gap-4 mb-3 sm:mb-6 md:mb-4 relative">
            <div className="absolute -left-3 sm:-left-6 top-1 font-lekton text-[9px] sm:text-[10px] text-teal-500/40 opacity-0 group-hover:opacity-100 transition-opacity">
              $&gt;
            </div>

            <div className="relative">
              <div className="h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center mx-auto sm:mx-0">
                <div className="absolute inset-0 bg-gradient-to-br from-teal-900/20 to-teal-700/10 rounded-sm"></div>
                <div className="relative z-10 text-teal-400">{feature.icon}</div>
              </div>
              {index < features.length - 1 && (
                <div className="absolute top-5 sm:top-6 left-2.5 sm:left-3 w-px h-3 sm:h-4 md:h-5 bg-gradient-to-b from-teal-500/30 to-transparent hidden sm:block"></div>
              )}
            </div>

            <div className="flex flex-col items-center sm:items-start gap-1 sm:gap-1">
              <h3 className="text-sm sm:text-[20px] md:text-sm font-medium text-white flex flex-col sm:flex-row items-center sm:items-center font-lekton">
                <span className="font-lekton text-[8px] sm:text-[12px] md:text-[11px] text-teal-500/70 mr-0 sm:mr-1.5 tracking-wider">{`0x${index.toString(16)}`}</span>
                {feature.title}
              </h3>

              <p className="text-[12px] sm:text-[16px] md:text-sm text-gray-500 leading-tight sm:pl-1 sm:border-l sm:border-teal-900/30 sm:ml-1 font-lekton text-center sm:text-left">
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
    icon: <CodeIcon className="h-3 w-3 sm:h-4 sm:w-4" />,
  },
  {
    title: "Visual Workflow Builder",
    description: "Drag-and-drop pre-audited Solana modules for fast, reliable builds.",
    icon: <BoxIcon className="h-3 w-3 sm:h-4 sm:w-4" />,
  },
  {
    title: "Instant Deployment",
    description: "Ship to devnet or mainnet in a single click.",
    icon: <ZapIcon className="h-3 w-3 sm:h-4 sm:w-4" />,
  },
  {
    title: "Live Iterations",
    description: "Update logic and push upgrades in real time.",
    icon: <RefreshCwIcon className="h-3 w-3 sm:h-4 sm:w-4" />,
  },
  {
    title: "Collaborative Workspace",
    description: "Real-time co-editing with built-in version control.",
    icon: <UsersIcon className="h-3 w-3 sm:h-4 sm:w-4" />,
  },
] 