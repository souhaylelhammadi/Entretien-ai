import React, { useState, useEffect } from "react";

const LogoSlider = () => {
  // Array of logos
  const logos = [
    { name: "XI", logo: "XI" },
    { name: "Perplexity", logo: "perplexity" },
    { name: "Anthropic", logo: "ANTHROPIC" },
    { name: "XI", logo: "XI" },
    { name: "Perplexity", logo: "perplexity" },
    { name: "Anthropic", logo: "ANTHROPIC" },
    { name: "Meta", logo: "Meta" },
    { name: "Perplexity", logo: "perplexity" },
    { name: "Anthropic", logo: "ANTHROPIC" },
    { name: "Meta", logo: "Meta" },
  ];

  // State for hover effects
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // Modern sophisticated color palette from provided hex codes
 const topColors = [
   "bg-gradient-to-r from-[#2563EB] to-[#1E40AF]", // Dégradé bleu
   "bg-gradient-to-r from-[#0D9488] to-[#0F766E]", // Dégradé vert
   "bg-gradient-to-r from-[#3B82F6] to-[#1D4ED8]", // Dégradé bleu clair
 ];

 const bottomColors = [
   "border-[#60A5FA] bg-gradient-to-br from-white to-[#F0F7FF]", // Fond dégradé avec bordure bleue
   "border-[#3B82F6] bg-gradient-to-br from-white to-[#E6F0FF]", // Fond dégradé avec bordure bleue claire
   "border-[#0D9488] bg-gradient-to-br from-white to-[#F0FDF4]", // Fond dégradé avec bordure verte
 ];

 const bottomTextColors = [
   "text-[#1F2937] hover:text-[#2563EB] transition-colors duration-300",
   "text-[#2563EB] hover:text-[#1E40AF] transition-colors duration-300",
   "text-[#0D9488] hover:text-[#0F766E] transition-colors duration-300",
 ];

  // Adjust speed based on screen width
  const [speed, setSpeed] = useState(20);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) {
        setSpeed(15); // Faster on mobile
      } else if (window.innerWidth < 1024) {
        setSpeed(20); // Medium on tablets
      } else {
        setSpeed(25); // Slower on desktop
      }
    };

    handleResize(); // Set initial speed
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="w-full bg-gradient-to-b from-[#D9E2EC] to-[#FFFFFF] py-6 md:py-10 overflow-hidden">
      {/* Top slider - left scroll */}
      <div className="mb-6 md:mb-10">
        <div className="relative w-full overflow-hidden">
          <div className="flex animate-marquee-left">
            {logos.slice(0, 6).map((logo, index) => (
              <div
                key={`top-${index}`}
                className={`flex-shrink-0 flex items-center justify-center ${
                  topColors[index % topColors.length]
                } rounded-xl h-14 sm:h-16 md:h-18 w-36 sm:w-44 md:w-52 mx-2 sm:mx-3 transform transition-all duration-300 ${
                  hoveredIndex === `top-${index}`
                    ? "scale-105 shadow-2xl translate-y-1"
                    : "shadow-lg"
                }`}
                onMouseEnter={() => setHoveredIndex(`top-${index}`)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <span className="text-white font-bold text-sm sm:text-base md:text-lg">
                  {logo.logo}
                </span>
              </div>
            ))}
            {/* Duplication for continuous animation */}
            {logos.slice(0, 6).map((logo, index) => (
              <div
                key={`top-dup-${index}`}
                className={`flex-shrink-0 flex items-center justify-center ${
                  topColors[index % topColors.length]
                } rounded-xl h-14 sm:h-16 md:h-18 w-36 sm:w-44 md:w-52 mx-2 sm:mx-3 transform transition-all duration-300 ${
                  hoveredIndex === `top-dup-${index}`
                    ? "scale-105 shadow-2xl translate-y-1"
                    : "shadow-lg"
                }`}
                onMouseEnter={() => setHoveredIndex(`top-dup-${index}`)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <span className="text-white font-bold text-sm sm:text-base md:text-lg">
                  {logo.logo}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom slider - right scroll */}
      <div>
        <div className="relative w-full overflow-hidden">
          <div className="flex animate-marquee-right">
            {logos.slice(4, 10).map((logo, index) => (
              <div
                key={`bottom-${index}`}
                className={`flex-shrink-0 flex items-center justify-center bg-white border-2 ${
                  bottomColors[index % bottomColors.length]
                } rounded-xl h-14 sm:h-16 md:h-18 w-36 sm:w-44 md:w-52 mx-2 sm:mx-3 shadow-md transform transition-all duration-300 ${
                  hoveredIndex === `bottom-${index}`
                    ? "scale-105 shadow-xl border-opacity-100"
                    : "border-opacity-70"
                }`}
                onMouseEnter={() => setHoveredIndex(`bottom-${index}`)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <span
                  className={`${
                    bottomTextColors[index % bottomTextColors.length]
                  } font-bold text-sm sm:text-base md:text-lg`}
                >
                  {logo.logo}
                </span>
              </div>
            ))}
            {/* Duplication for continuous animation */}
            {logos.slice(4, 10).map((logo, index) => (
              <div
                key={`bottom-dup-${index}`}
                className={`flex-shrink-0 flex items-center justify-center bg-white border-2 ${
                  bottomColors[index % bottomColors.length]
                } rounded-xl h-14 sm:h-16 md:h-18 w-36 sm:w-44 md:w-52 mx-2 sm:mx-3 shadow-md transform transition-all duration-300 ${
                  hoveredIndex === `bottom-dup-${index}`
                    ? "scale-105 shadow-xl border-opacity-100"
                    : "border-opacity-70"
                }`}
                onMouseEnter={() => setHoveredIndex(`bottom-dup-${index}`)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <span
                  className={`${
                    bottomTextColors[index % bottomTextColors.length]
                  } font-bold text-sm sm:text-base md:text-lg`}
                >
                  {logo.logo}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dynamic styles with speed variable */}
      <style jsx>{`
        @keyframes marquee-left {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-100%);
          }
        }
        @keyframes marquee-right {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(0);
          }
        }
        .animate-marquee-left {
          animation: marquee-left ${speed}s linear infinite;
        }
        .animate-marquee-right {
          animation: marquee-right ${speed}s linear infinite;
        }
        .animate-marquee-left:hover,
        .animate-marquee-right:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
};

export default LogoSlider;
