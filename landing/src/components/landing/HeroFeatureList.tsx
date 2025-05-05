import { CodeIcon, BoxIcon, ZapIcon, RefreshCwIcon, UsersIcon } from "lucide-react"

export default function HeroFeatureList() {
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

      <div className="relative z-10 flex flex-col items-center lg:items-start lg:justify-start w-full">
        {features.map((feature, index) => (
          <div key={index} className="w-full w-[90%] group 
                flex 
                flex-row xs:flex-row sm:flex-row 
                items-start 
                text-center xs:text-left sm:text-left 
                xs:justify-start
                sm:items-start 
                gap-3 xs:gap-3 sm:gap-4 
                mb-3 xs:mb-3 sm:mb-6 md:mb-4 lg:mb-3
                relative
                list-none
                xs:bg-[#0f111b] xs:p-1 xs:rounded">

            <span className="relative flex h-6 w-6 sm:h-6 sm:w-6 md:h-6 md:w-6 lg:h-6 lg:w-6 xl:h-6 xl:w-6 
                            items-center justify-center shrink-0">
              <span className="absolute inset-0 rounded-sm bg-gradient-to-br from-teal-900/25 to-teal-700/15" />
              <span className="relative z-10 text-teal-400 h-3 w-3 xs:h-4 xs:w-4 sm:h-4 sm:w-4 flex items-center justify-center">
                {feature.icon}
              </span>
              
              {index < features.length - 1 && (
                <div className="absolute top-6 xs:top-6 sm:top-6 left-2.5 xs:left-3 sm:left-3 w-px h-3 xs:h-4 sm:h-5 md:h-6 bg-gradient-to-b from-teal-500/30 to-transparent hidden xs:block"></div>
              )}
            </span>

            <div className="flex flex-col items-start items-start sm:items-start text-left gap-1 sm:gap-1">
              <h3 className="text-xs xs:text-sm sm:text-[20px] md:text-[13px] font-medium text-white
                            flex flex-row xs:flex-row sm:flex-row items-center xs:items-center sm:items-center font-lekton">
                <span className="font-mono text-[7px] xs:text-[10px] sm:text-[11px] 
                                  text-teal-500/70 mr-1 xs:mr-1.5 sm:mr-1.5 tracking-wider">{`0x${index.toString(16)}`}</span>
                {feature.title}
              </h3>

              <p className="text-[10px] sm:text-[16px] md:text-[11px] text-gray-400 
                            leading-tight xs:pl-1 xs:border-l xs:border-teal-900/30 xs:ml-1 font-lekton text-left">
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
    icon: <CodeIcon className="h-3 w-3 xs:h-4 xs:w-4 sm:h-4 sm:w-4" />,
  },
  {
    title: "Visual Workflow Builder",
    description: "Drag-and-drop pre-audited Solana modules for fast, reliable builds.",
    icon: <BoxIcon className="h-3 w-3 xs:h-4 xs:w-4 sm:h-4 sm:w-4" />,
  },
  {
    title: "Instant Deployment",
    description: "Ship to devnet or mainnet in a single click.",
    icon: <ZapIcon className="h-3 w-3 xs:h-4 xs:w-4 sm:h-4 sm:w-4" />,
  },
  {
    title: "Live Iterations",
    description: "Update logic and push upgrades in real time.",
    icon: <RefreshCwIcon className="h-3 w-3 xs:h-4 xs:w-4 sm:h-4 sm:w-4" />,
  },
  {
    title: "Collaborative Workspace",
    description: "Real-time co-editing with built-in version control.",
    icon: <UsersIcon className="h-3 w-3 xs:h-4 xs:w-4 sm:h-4 sm:w-4" />,
  },
] 