import {
  Upload,
  Video,
  Brain,
  FileText,
  ArrowRight,
  Clock,
  CheckCircle,
} from "lucide-react";

const InterviewProcess = () => {
  const steps = [
    {
      number: "01",
      icon: Upload,
      title: "Upload CV",
      description: "Téléchargez votre CV en format PDF, DOC ou DOCX",
      detail: "Notre IA analyse automatiquement votre profil",
      color: "blue",
      duration: "30 sec",
    },
    {
      number: "02",
      icon: Video,
      title: "Entretien Vidéo",
      description: "Enregistrez vos réponses aux questions personnalisées",
      detail: "Questions générées selon votre expérience",
      color: "purple",
      duration: "15-30 min",
    },
    {
      number: "03",
      icon: Brain,
      title: "Analyse IA",
      description: "Transcription et évaluation automatique par Grok AI",
      detail: "Analyse des compétences et soft skills",
      color: "green",
      duration: "2-5 min",
    },
    {
      number: "04",
      icon: FileText,
      title: "Rapport Final",
      description: "Recevez votre évaluation détaillée et recommandations",
      detail: "Exportable en PDF avec scoring",
      color: "indigo",
      duration: "Instantané",
    },
  ];

  const getColorClasses = (color) => {
    const colorMap = {
      blue: "from-blue-500 to-blue-600",
      purple: "from-purple-500 to-purple-600",
      green: "from-green-500 to-green-600",
      indigo: "from-indigo-500 to-indigo-600",
    };
    return colorMap[color];
  };

  return (
    <section className="py-24 px-4 bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-3 bg-white rounded-full px-6 py-3 mb-8 shadow-md">
            <Clock className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-semibold text-gray-700 tracking-wide">
              PROCESSUS SIMPLIFIÉ
            </span>
          </div>

          <h2 className="text-5xl md:text-6xl font-extrabold text-gray-900 mb-6 leading-tight">
            4 Étapes Vers Votre
            <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Entretien Parfait
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-12">
            Un processus fluide et automatisé qui vous fait gagner du temps tout
            en maximisant la qualité de l'évaluation
          </p>
        </div>

        {/* Process Steps */}
        <div className="relative">
          {/* Connection line */}
          <div className="hidden lg:block absolute top-32 left-1/2 -translate-x-1/2 w-3/4 h-0.5 bg-gradient-to-r from-blue-200 via-purple-200 to-green-200"></div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
            {steps.map((step, index) => {
              const IconComponent = step.icon;
              return (
                <div
                  key={index}
                  className="group bg-white/80 backdrop-blur-sm border-2 border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-2xl transition-all duration-500 transform hover:scale-105 hover:-translate-y-4"
                >
                  <div className="p-8 text-center">
                    {/* Step number */}
                    <div
                      className={`w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-r ${getColorClasses(
                        step.color
                      )} flex items-center justify-center text-white text-xl font-extrabold group-hover:scale-110 transition-transform duration-300`}
                    >
                      {step.number}
                    </div>

                    {/* Icon */}
                    <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gray-100 flex items-center justify-center group-hover:bg-blue-50 transition-colors duration-300">
                      <IconComponent className="w-7 h-7 text-gray-600 group-hover:text-blue-600 transition-colors duration-300" />
                    </div>

                    {/* Duration badge */}
                    <div className="inline-block bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full mb-4">
                      {step.duration}
                    </div>

                    <h3 className="text-xl font-bold text-gray-800 mb-3 group-hover:text-gray-900 transition-colors">
                      {step.title}
                    </h3>

                    <p className="text-gray-600 mb-4 leading-relaxed">
                      {step.description}
                    </p>

                    <p className="text-sm text-blue-600 font-medium">
                      {step.detail}
                    </p>

                    {/* Arrow for desktop */}
                    {index < steps.length - 1 && (
                      <div className="hidden lg:block absolute top-32 -right-4 -translate-y-1/2">
                        <ArrowRight className="w-6 h-6 text-blue-400" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-20 grid md:grid-cols-3 gap-8">
          <div className="text-center bg-white/60 backdrop-blur-sm rounded-2xl p-8 border border-blue-100">
            <div className="text-4xl font-extrabold text-blue-600 mb-2">
              15 min
            </div>
            <div className="text-gray-600 font-medium">
              Durée moyenne d'entretien
            </div>
          </div>
          <div className="text-center bg-white/60 backdrop-blur-sm rounded-2xl p-8 border border-green-100">
            <div className="text-4xl font-extrabold text-green-600 mb-2">
              95%
            </div>
            <div className="text-gray-600 font-medium">
              Précision de l'analyse IA
            </div>
          </div>
          <div className="text-center bg-white/60 backdrop-blur-sm rounded-2xl p-8 border border-purple-100">
            <div className="text-4xl font-extrabold text-purple-600 mb-2">
              24/7
            </div>
            <div className="text-gray-600 font-medium">
              Disponibilité de la plateforme
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-12 py-6 text-xl font-bold rounded-xl shadow-xl hover:shadow-blue-500/25 transition-all duration-300 transform hover:scale-105 flex items-center justify-center mx-auto">
            <CheckCircle className="w-6 h-6 mr-3" />
            COMMENCER MON ENTRETIEN
          </button>
        </div>
      </div>
    </section>
  );
};

export default InterviewProcess;
