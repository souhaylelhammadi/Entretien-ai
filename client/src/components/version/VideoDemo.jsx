import { Play, Video, Mic, Eye, MessageSquare } from "lucide-react";
import { useState } from "react";

const VideoDemo = () => {
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlayDemo = () => {
    setIsPlaying(true);
    // Simulate video play
    setTimeout(() => setIsPlaying(false), 3000);
  };

  return (
    <section className="py-24 px-4 bg-gradient-to-br from-white to-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-3 bg-blue-100 rounded-full px-6 py-3 mb-8">
            <Video className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-semibold text-blue-800 tracking-wide">
              DÉMONSTRATION
            </span>
          </div>

          <h2 className="text-5xl md:text-6xl font-extrabold text-gray-900 mb-6 leading-tight">
            Découvrez Interview AI
            <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              en Action
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Voyez comment notre plateforme transforme l'expérience d'entretien
            pour les candidats et les recruteurs
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Video Player Mockup */}
          <div className="relative">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 border-0 shadow-2xl rounded-lg overflow-hidden">
              <div className="p-0">
                <div className="relative aspect-video bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center">
                  {/* Video interface mockup */}
                  <div className="absolute inset-4 border-2 border-white/20 rounded-lg"></div>

                  {/* Play button */}
                  <button
                    onClick={handlePlayDemo}
                    className={`w-20 h-20 rounded-full bg-white/90 hover:bg-white text-blue-600 transition-all duration-300 ${
                      isPlaying ? "scale-0" : "scale-100"
                    } flex items-center justify-center`}
                  >
                    <Play className="w-8 h-8 ml-1" />
                  </button>

                  {/* Recording indicators */}
                  <div className="absolute top-6 left-6 flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        isPlaying ? "bg-red-500 animate-pulse" : "bg-gray-400"
                      }`}
                    ></div>
                    <span className="text-white text-sm font-medium">
                      {isPlaying ? "REC 01:23" : "Prêt à enregistrer"}
                    </span>
                  </div>

                  {/* Controls */}
                  <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-4">
                    <button className="bg-white/20 border border-white/20 text-white hover:bg-white/30 px-2 py-1 rounded">
                      <Mic className="w-4 h-4" />
                    </button>
                    <button className="bg-white/20 border border-white/20 text-white hover:bg-white/30 px-2 py-1 rounded">
                      <Video className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Question overlay */}
                  {isPlaying && (
                    <div className="absolute bottom-20 left-6 right-6 bg-black/60 backdrop-blur-sm rounded-lg p-4 animate-fade-in">
                      <p className="text-white text-sm font-medium">
                        "Parlez-moi d'un projet React.js complexe que vous avez
                        mené..."
                      </p>
                    </div>
                  )}
                </div>

                {/* Video timeline */}
                <div className="p-4 bg-gray-800">
                  <div className="flex items-center gap-4">
                    <span className="text-white text-sm">00:00</span>
                    <div className="flex-1 bg-gray-600 rounded-full h-2">
                      <div
                        className={`bg-blue-500 h-2 rounded-full transition-all duration-1000 ${
                          isPlaying ? "w-1/4" : "w-0"
                        }`}
                      ></div>
                    </div>
                    <span className="text-white text-sm">15:00</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Features list */}
          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Eye className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  Interface Intuitive
                </h3>
                <p className="text-gray-600">
                  Interface claire et professionnelle qui met les candidats à
                  l'aise pendant l'enregistrement.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  Questions Personnalisées
                </h3>
                <p className="text-gray-600">
                  Questions générées automatiquement en fonction du CV et du
                  poste visé.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Video className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  Qualité Optimale
                </h3>
                <p className="text-gray-600">
                  Enregistrement en haute définition avec optimisation
                  automatique selon la connexion.
                </p>
              </div>
            </div>

            <button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-6 text-lg font-bold rounded-xl shadow-lg hover:shadow-blue-500/25 transition-all duration-300 flex items-center justify-center">
              <Play className="w-5 h-5 mr-3" />
              ESSAYER LA DÉMO INTERACTIVE
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default VideoDemo;
