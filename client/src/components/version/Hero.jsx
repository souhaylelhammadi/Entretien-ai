import {
  ArrowDown,
  Play,
  Video,
  Brain,
  Mic,
  BarChart3,
  Sparkles,
  Zap,
} from "lucide-react";

const Hero = () => {
  const scrollToFeatures = () => {
    const featuresSection = document.getElementById("features-section");
    featuresSection?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-purple-900">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-96 h-96 bg-blue-500/20 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute top-40 right-20 w-96 h-96 bg-purple-500/20 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-40 w-96 h-96 bg-cyan-500/20 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      {/* Grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.1)_1px,transparent_1px)] bg-[size:100px_100px] animate-pulse"></div>

      {/* Floating tech elements */}
      <div className="absolute top-1/4 left-1/6 animate-float">
        <Video className="w-12 h-12 text-blue-400 opacity-60" />
      </div>
      <div className="absolute top-1/3 right-1/4 animate-float delay-1000">
        <Brain className="w-14 h-14 text-purple-400 opacity-60" />
      </div>
      <div className="absolute bottom-1/3 left-1/3 animate-float delay-2000">
        <Mic className="w-10 h-10 text-cyan-400 opacity-60" />
      </div>
      <div className="absolute bottom-1/4 right-1/6 animate-float delay-3000">
        <BarChart3 className="w-12 h-12 text-indigo-400 opacity-60" />
      </div>

      <div className="relative z-10 text-center max-w-7xl mx-auto">
        {/* Badge */}
        <div className="inline-flex items-center gap-4 bg-white/10 backdrop-blur-md border border-blue-400/30 rounded-full px-8 py-4 mb-12 shadow-2xl animate-fade-in">
          <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
          <Sparkles className="w-6 h-6 text-cyan-300 animate-pulse" />
          <span className="text-lg font-bold text-white tracking-wider">
            INTERVIEW AI • NOUVELLE GÉNÉRATION
          </span>
          <div className="w-3 h-3 bg-purple-400 rounded-full animate-pulse delay-500"></div>
        </div>

        <h1 className="text-7xl md:text-9xl font-extrabold mb-12 leading-none animate-scale-in">
          <span className="text-white">INTERVIEW</span>
          <br />
          <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent animate-gradient bg-[length:200%_200%]">
            AI
          </span>
        </h1>

        <h2 className="text-3xl md:text-5xl text-gray-200 mb-8 font-bold animate-slide-up">
          Plateforme d'Entretiens Vidéo
          <span className="text-transparent bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text">
            {" "}
            Automatisés
          </span>
        </h2>

        <p className="text-xl md:text-2xl text-gray-300 mb-16 max-w-5xl mx-auto leading-relaxed font-light animate-fade-in delay-500">
          Révolutionnez votre processus de recrutement avec des entretiens vidéo
          asynchrones, transcription automatique par Whisper et analyse
          intelligente par Grok AI.
        </p>

        <div className="flex flex-col sm:flex-row gap-8 justify-center items-center mb-20 animate-slide-up delay-700">
          <button
            className="group relative bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 hover:from-cyan-700 hover:via-blue-700 hover:to-purple-700 text-white px-12 py-8 text-xl font-bold rounded-2xl shadow-2xl hover:shadow-cyan-500/30 transition-all duration-500 transform hover:scale-110 overflow-hidden"
            onClick={scrollToFeatures}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
            <Play className="w-7 h-7 mr-4 group-hover:scale-125 transition-transform relative z-10" />
            <span className="relative z-10">COMMENCER L'ENTRETIEN</span>
          </button>

          <button className="group border-2 border-cyan-400/50 text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-300 backdrop-blur-sm px-12 py-8 text-xl font-bold rounded-2xl transition-all duration-500 hover:scale-110">
            <Video className="w-7 h-7 mr-4 group-hover:text-purple-400 transition-colors" />
            VOIR DÉMO
          </button>
        </div>

        {/* Key features preview */}
        <div className="grid md:grid-cols-3 gap-8 mb-16 animate-fade-in delay-1000">
          <div className="group bg-white/5 backdrop-blur-md rounded-3xl p-8 border border-blue-400/20 hover:shadow-2xl hover:shadow-blue-500/30 transition-all duration-700 hover:scale-105 hover:-translate-y-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-500">
              <Video className="w-8 h-8 text-white" />
            </div>
            <h3 className="font-bold text-white text-xl mb-3">
              Entretiens Vidéo
            </h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              Enregistrement asynchrone avec WebRTC haute qualité
            </p>
          </div>

          <div className="group bg-white/5 backdrop-blur-md rounded-3xl p-8 border border-purple-400/20 hover:shadow-2xl hover:shadow-purple-500/30 transition-all duration-700 hover:scale-105 hover:-translate-y-4">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-500">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <h3 className="font-bold text-white text-xl mb-3">Analyse IA</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              Évaluation intelligente par Grok AI avec scoring automatique
            </p>
          </div>

          <div className="group bg-white/5 backdrop-blur-md rounded-3xl p-8 border border-green-400/20 hover:shadow-2xl hover:shadow-green-500/30 transition-all duration-700 hover:scale-105 hover:-translate-y-4">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-500">
              <BarChart3 className="w-8 h-8 text-white" />
            </div>
            <h3 className="font-bold text-white text-xl mb-3">
              Rapports Détaillés
            </h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              Génération automatique d'évaluations complètes
            </p>
          </div>
        </div>

        <div className="animate-bounce delay-1500">
          <ArrowDown className="mx-auto text-cyan-400 w-10 h-10" />
        </div>
      </div>
    </section>
  );
};

export default Hero;
