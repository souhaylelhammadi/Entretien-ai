import {
  Video,
  Mic,
  Brain,
  FileText,
  BarChart3,
  Clock,
  Shield,
  Zap,
  Sparkles,
} from "lucide-react";

const Features = () => {
  const features = [
    {
      icon: Video,
      title: "Entretiens Vidéo Asynchrones",
      description:
        "Interface intuitive permettant aux candidats d'enregistrer leurs réponses à leur rythme avec une qualité vidéo optimale.",
      color: "blue",
      details: ["WebRTC natif", "Format WebM optimisé", "Gestion permissions"],
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      icon: Mic,
      title: "Transcription Automatique",
      description:
        "Conversion automatique des réponses vidéo en texte grâce à la technologie Whisper d'OpenAI avec support multilingue.",
      color: "purple",
      details: [
        "Précision élevée",
        "Support multilingue",
        "Traitement temps réel",
      ],
      gradient: "from-purple-500 to-pink-500",
    },
    {
      icon: Brain,
      title: "Analyse IA Avancée",
      description:
        "Évaluation intelligente des réponses par Grok AI avec scoring automatique et insights comportementaux détaillés.",
      color: "green",
      details: ["Grok AI", "Scoring automatique", "Insights comportementaux"],
      gradient: "from-green-500 to-emerald-500",
    },
    {
      icon: FileText,
      title: "Rapports Détaillés",
      description:
        "Génération automatique de rapports d'évaluation complets avec recommandations personnalisées et métriques détaillées.",
      color: "indigo",
      details: ["PDF exportable", "Métriques détaillées", "Recommandations"],
      gradient: "from-indigo-500 to-blue-500",
    },
    {
      icon: BarChart3,
      title: "Analytics Avancés",
      description:
        "Tableaux de bord interactifs pour analyser les performances et optimiser le processus de recrutement en temps réel.",
      color: "cyan",
      details: ["Métriques temps réel", "Comparaisons", "Tendances"],
      gradient: "from-cyan-500 to-blue-500",
    },
    {
      icon: Shield,
      title: "Sécurité & Confidentialité",
      description:
        "Protection maximale des données avec chiffrement end-to-end et conformité RGPD garantie pour tous les utilisateurs.",
      color: "red",
      details: ["Chiffrement E2E", "RGPD compliant", "Stockage sécurisé"],
      gradient: "from-red-500 to-pink-500",
    },
  ];

  return (
    <section
      id="features-section"
      className="py-32 px-4 bg-gradient-to-b from-slate-900 via-gray-900 to-black relative overflow-hidden"
    >
      {/* Animated background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:100px_100px]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_70%)]"></div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-24">
          <div className="inline-flex items-center gap-4 bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-md border border-blue-400/30 rounded-full px-8 py-4 mb-12 shadow-2xl">
            <Sparkles className="w-6 h-6 text-cyan-300 animate-pulse" />
            <span className="text-lg font-bold text-cyan-200 tracking-wider">
              FONCTIONNALITÉS AVANCÉES
            </span>
            <Zap className="w-6 h-6 text-purple-300 animate-pulse" />
          </div>

          <h2 className="text-6xl md:text-7xl font-extrabold text-white mb-8 leading-tight">
            Technologie de Pointe pour
            <span className="block bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
              l'Entretien du Futur
            </span>
          </h2>
          <p className="text-2xl text-gray-300 max-w-4xl mx-auto font-light">
            Une suite complète d'outils alimentés par l'IA pour révolutionner
            votre processus de recrutement
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <div
                key={index}
                className="group bg-gradient-to-br from-slate-800/80 to-slate-900/90 backdrop-blur-lg border border-blue-400/20 hover:border-cyan-400/40 hover:shadow-2xl hover:shadow-cyan-500/20 transition-all duration-700 transform hover:scale-105 hover:-translate-y-4 overflow-hidden"
              >
                <div className="text-center pb-6 pt-8 relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-purple-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div
                    className={`w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-lg`}
                  >
                    <IconComponent className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white group-hover:text-cyan-300 transition-colors duration-300 relative z-10">
                    {feature.title}
                  </h3>
                </div>
                <div className="text-center px-6 pb-8 relative z-10">
                  <p className="text-gray-300 mb-8 leading-relaxed text-lg group-hover:text-gray-200 transition-colors duration-300">
                    {feature.description}
                  </p>
                  <div className="space-y-3">
                    {feature.details.map((detail, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-center gap-3 group-hover:scale-105 transition-transform duration-300"
                      >
                        <div
                          className={`w-3 h-3 rounded-full bg-gradient-to-r ${feature.gradient} animate-pulse`}
                        ></div>
                        <span className="text-sm text-gray-400 font-medium group-hover:text-gray-300 transition-colors duration-300">
                          {detail}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tech stack avec animations */}
        <div className="mt-24 text-center">
          <h3 className="text-3xl font-bold text-white mb-12">
            Construit avec les Meilleures Technologies
          </h3>
          <div className="flex flex-wrap justify-center items-center gap-12">
            {[
              {
                name: "React.js",
                color: "bg-blue-500",
                textColor: "text-blue-300",
              },
              {
                name: "MongoDB",
                color: "bg-green-500",
                textColor: "text-green-300",
              },
              {
                name: "Whisper AI",
                color: "bg-purple-500",
                textColor: "text-purple-300",
              },
              {
                name: "Grok AI",
                color: "bg-red-500",
                textColor: "text-red-300",
              },
              {
                name: "WebRTC",
                color: "bg-yellow-500",
                textColor: "text-yellow-300",
              },
            ].map((tech, index) => (
              <div
                key={index}
                className="group flex items-center gap-4 bg-white/5 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/10 hover:border-white/20 transition-all duration-300 hover:scale-110"
              >
                <div
                  className={`w-12 h-12 ${tech.color} rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-lg`}
                ></div>
                <span
                  className={`font-bold text-lg ${tech.textColor} group-hover:text-white transition-colors duration-300`}
                >
                  {tech.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;
