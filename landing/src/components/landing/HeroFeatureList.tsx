import { CodeIcon, BoxIcon, ZapIcon, RefreshCwIcon, UsersIcon } from "lucide-react"

export default function HeroFeatureList() {
  return (
    <div className="relative py-1 sm:py-2 md:py-3 font-lekton w-full max-w-[30rem] mx-auto lg:mx-0">
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
          <div key={index} className="w-full group 
                flex 
                flex-row
                items-start 
                text-left
                gap-3 sm:gap-4 
                mb-3 sm:mb-5
                relative
                list-none">

            <span className="relative flex h-6 w-6
                            items-center justify-center shrink-0">
              <span className="absolute inset-0 rounded-sm bg-gradient-to-br from-teal-900/25 to-teal-700/15" />
              <span className="relative z-10 text-teal-400 h-4 w-4 flex items-center justify-center">
                {feature.icon}
              </span>
              
              {index < features.length - 1 && (
                <div className="absolute top-6 left-3 w-px h-5 bg-gradient-to-b from-teal-500/30 to-transparent"></div>
              )}
            </span>

            <div className="flex flex-col items-start text-left gap-1">
              <h3 className="text-[clamp(0.9rem,0.5vw+0.6rem,1.1rem)] font-medium text-white
                            flex flex-row items-center font-lekton">
                <span className="font-mono text-[clamp(0.65rem,0.3vw+0.5rem,0.8rem)]
                                  text-teal-500/70 mr-1.5 tracking-wider">{`0x${index.toString(16)}`}</span>
                {feature.title}
              </h3>

              <p className="text-[clamp(0.8rem,0.4vw+0.55rem,1rem)] text-gray-400 
                            leading-tight border-l border-teal-900/30 pl-3 ml-1 font-lekton">
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
    title: "AI-Powered dApps",
    description: "Turn simple English prompts into secure, launch-ready Solana applications.",
    icon: <CodeIcon className="h-3 w-3 xs:h-4 xs:w-4 sm:h-4 sm:w-4" />,
  },
  {
    title: "Drag, Drop, Done",
    description: "Quickly build workflows using pre-audited Solana components—no code required.",
    icon: <BoxIcon className="h-3 w-3 xs:h-4 xs:w-4 sm:h-4 sm:w-4" />,
  },
  {
    title: "Deploy Instantly",
    description: "Launch to Devnet or Mainnet in just one click.",
    icon: <ZapIcon className="h-3 w-3 xs:h-4 xs:w-4 sm:h-4 sm:w-4" />,
  },
  {
    title: "Live Updates",
    description: "Push real-time changes and iterate instantly.",
    icon: <RefreshCwIcon className="h-3 w-3 xs:h-4 xs:w-4 sm:h-4 sm:w-4" />,
  },
  {
    title: "Team Sync",
    description: "Real-time collaboration, integrated version control.",
    icon: <UsersIcon className="h-3 w-3 xs:h-4 xs:w-4 sm:h-4 sm:w-4" />,
  },
] 