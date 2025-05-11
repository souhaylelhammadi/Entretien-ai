import React, { useState } from "react";
import {
  Fingerprint,
  BarChart2,
  Shield,
  Users,
  ChevronRight,
  Zap,
} from "lucide-react";


const FeatureCard = ({
  title,
  description,
  icon,
  accent,
  percentage,
  gradient,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const gradientBg = gradient || "from-blue-500 to-indigo-600";

  return (
    <div
      className={`relative bg-[#111630] backdrop-blur-sm border border-gray-800 rounded-xl p-6 flex flex-col h-full transition-all duration-300 ${
        isHovered ? "transform scale-[1.02] shadow-xl shadow-blue-900/20" : ""
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="mb-5">
        {percentage ? (
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-36 h-36 rounded-full border-2 border-gray-700 flex items-center justify-center overflow-hidden">
                <div
                  className={`absolute inset-0  rounded-full bg-gradient-to-br ${gradientBg} opacity-10`}
                ></div>
                <span className="text-5xl font-bold rounded-full bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">
                  {percentage}
                </span>
              </div>
              <div
                className={`absolute top-0 left-0 w-full h-full rounded-full border-t-2 border-blue-400 opacity-70 ${
                  isHovered ? "animate-pulse" : ""
                }`}
                style={{ clipPath: "polygon(0 0, 100% 0, 100% 50%, 0 50%)" }}
              ></div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div
              className={`w-20 h-20 rounded-full bg-gradient-to-br ${gradientBg} bg-opacity-10 border border-gray-800 flex items-center justify-center text-blue-400 transition-all duration-300 ${
                isHovered ? "animate-pulse shadow-lg shadow-blue-500/20" : ""
              }`}
            >
              {icon}
            </div>
          </div>
        )}
      </div>
      <h3 className="text-white text-2xl font-bold text-center mb-3">
        {title}
      </h3>
      <p className="text-gray-400 text-center text-sm">{description}</p>
      {accent && (
        <div
          className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 to-cyan-300"
          style={{ width: "30%", margin: "0 auto" }}
        ></div>
      )}
      <div
        className={`absolute inset-0 rounded-xl border border-blue-400 opacity-0 transition-opacity duration-300 ${
          isHovered ? "opacity-20" : ""
        }`}
      ></div>
    </div>
  );
};


const AnimatedChart = () => {
  return (
    <div className="w-full h-32 flex items-end">
      <svg
        viewBox="0 0 400 100"
        width="100%"
        height="100%"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2AADEA" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#2AADEA" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0,50 C20,40 40,80 60,70 C80,60 100,20 120,30 C140,40 160,90 180,80 C200,70 220,30 240,40 C260,50 280,20 300,30 C320,40 340,60 360,50 C380,40 400,20 400,30"
          fill="none"
          stroke="#2AADEA"
          strokeWidth="3"
          className="animate-pulse"
        />
        <path
          d="M0,50 C20,40 40,80 60,70 C80,60 100,20 120,30 C140,40 160,90 180,80 C200,70 220,30 240,40 C260,50 280,20 300,30 C320,40 340,60 360,50 C380,40 400,20 400,30 L400,100 L0,100 Z"
          fill="url(#chartGradient)"
          strokeWidth="0"
        />
      </svg>
    </div>
  );
};

// Enhanced user avatars with animation
const UserAvatars = () => {
  return (
    <div className="absolute right-6 bottom-6 flex flex-col space-y-4">
      <div className="flex items-center group">
        <div className="bg-black bg-opacity-60 backdrop-blur-sm rounded-full py-1 px-3 mr-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <span className="text-xs text-white whitespace-nowrap">Glodie</span>
        </div>
        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 border border-gray-700 shadow-lg shadow-orange-600/20 group-hover:scale-110 transition-transform duration-300"></div>
      </div>
      <div className="flex items-center group">
        <div className="bg-black bg-opacity-60 backdrop-blur-sm rounded-full py-1 px-3 mr-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <span className="text-xs text-white whitespace-nowrap">M. Irung</span>
        </div>
        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-400 to-indigo-500 border border-gray-700 shadow-lg shadow-blue-600/20 group-hover:scale-110 transition-transform duration-300"></div>
      </div>
      <div className="flex items-center group">
        <div className="bg-black bg-opacity-60 backdrop-blur-sm rounded-full py-1 px-3 mr-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <span className="text-xs text-white whitespace-nowrap">B. Ng</span>
        </div>
        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-400 to-pink-500 border border-gray-700 shadow-lg shadow-purple-600/20 group-hover:scale-110 transition-transform duration-300"></div>
      </div>
    </div>
  );
};

// Modern horizontal feature card
const HorizontalFeatureCard = ({
  title,
  description,
  icon,
  children,
  gradient,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative bg-[#111630]  backdrop-blur-sm border border-gray-800 rounded-xl p-6 overflow-hidden transition-all duration-300"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start mb-4">
        <div
          className={`w-12 h-12 rounded-full bg-gradient-to-br ${gradient} bg-opacity-10 flex items-center justify-center text-blue-400 mr-4 transition-all duration-300 ${
            isHovered ? "shadow-lg shadow-blue-500/20" : ""
          }`}
        >
          {icon}
        </div>
        <div>
          <h3 className="text-white text-xl font-bold">{title}</h3>
          <p className="text-gray-400 text-sm mt-2">{description}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
      <div
        className={`absolute top-0 right-0 w-1 h-full bg-gradient-to-b from-blue-400 to-cyan-300 transition-all duration-300 ${
          isHovered ? "h-full" : "h-1/2"
        }`}
      ></div>

      <div
        className={`absolute bottom-4 right-4 rounded-full p-2 text-white bg-gradient-to-r from-blue-500 to-cyan-400 opacity-0 transform translate-y-2 transition-all duration-300 ${
          isHovered ? "opacity-100 translate-y-0" : ""
        }`}
      >
        <ChevronRight size={16} />
      </div>
    </div>
  );
};

const InterviewFeaturesGrid = () => {
  return (
    <div className=" min-h-screen p-8 ">
      <div className="px-6 py-4">
        <h4 className="text-3xl lg:text-5xl lg:leading-tight max-w-5xl mx-auto text-center tracking-tight font-medium text-[#233dd0]">
          Maîtrisez vos entretiens techniques grâce au coaching et aux retours
          en temps réel de l’IA
        </h4>
        <p className="text-sm lg:text-base max-w-2xl my-4 mx-auto text-center text-[#2E4A7D] font-normal">
          Rejoignez des milliers de développeurs juniors et commencez vos
          entretiens en toute confiance dès aujourd’hui
        </p>
      </div>
      <div className="max-w-6xl mx-auto relative">
        {/* Decorative elements */}
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500 rounded-full filter blur-[150px] opacity-20"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500 rounded-full filter blur-[150px] opacity-20"></div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 relative z-10">
          {/* Success Rate Card */}
          <FeatureCard
            title="Taux de réussite"
            description=""
            percentage="95%"
            gradient="from-green-400 to-cyan-500 reduced"
          />

          {/* AI-Powered Analysis Card */}
          <FeatureCard
            title="Analyse propulsée par l’IA"
            description="Une technologie avancée d’IA analyse vos réponses en temps réel et vous fournit un retour détaillé sur la précision technique, les compétences en communication et votre approche de résolution de problèmes."
            icon={<Fingerprint size={32} />}
            gradient="from-blue-500 to-indigo-600"
          />

          {/* Performance Metrics Card */}
          <FeatureCard
            title="Performance Metrics"
            description="Suivez vos performances en entretien grâce à des métriques complètes, identifiant vos points forts et les axes d’amélioration sur les plans technique, comportemental et communicationnel."
            icon={<BarChart2 size={32} />}
            accent={true}
            gradient="from-cyan-400 to-blue-600"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
          {/* Personalized Question Bank Card */}
          <HorizontalFeatureCard
            title="Base de données de questions personnalisées"
            description="Accédez à des questions d'entretien spécifiques au rôle, sélectionnées par des experts de l'industrie et mises à jour en continu pour correspondre aux tendances de recrutement."
            icon={<Shield size={24} />}
            gradient="from-blue-500 to-indigo-600"
          >
            <AnimatedChart />
          </HorizontalFeatureCard>

          {/* Resume-Tailored Practice Card */}
          <HorizontalFeatureCard
            title="Pratique adaptée à votre CV"
            description="Notre IA analyse votre CV pour générer des réponses optimales et vous aider à vous préparer aux questions sur vos compétences spécifiques."
            icon={<Users size={24} />}
            gradient="from-purple-500 to-pink-600"
          >
            <div className="h-32 relative">
              <UserAvatars />
            </div>
          </HorizontalFeatureCard>
        </div>
      </div>
    </div>
  );
};

export default InterviewFeaturesGrid;
