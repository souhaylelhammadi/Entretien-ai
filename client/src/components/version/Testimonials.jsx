import { Star, Zap, Brain, Target } from "lucide-react";

const Testimonials = () => {
  const testimonials = [
    {
      name: "Marie Dubois",
      role: "Directrice IA & Innovation",
      company: "TechCorp",
      content:
        "Cette plateforme a révolutionné notre processus de recrutement. L'IA génère des questions d'une précision chirurgicale qui révèlent le vrai potentiel des candidats.",
      avatar: "M",
      rating: 5,
      tech: "Machine Learning",
    },
    {
      name: "Pierre Martin",
      role: "CTO & Tech Lead",
      company: "InnovateLab",
      content:
        "L'intelligence artificielle comprend parfaitement les profils techniques. Les questions générées sont exactement celles qu'un expert formulerait après une analyse approfondie.",
      avatar: "P",
      rating: 5,
      tech: "Deep Learning",
    },
    {
      name: "Sarah Chen",
      role: "Consultante RH Senior",
      company: "Future Talent",
      content:
        "Mes clients sont impressionnés par la qualité des entretiens. Cette solution IA me permet d'offrir un service premium révolutionnaire à toutes les entreprises.",
      avatar: "S",
      rating: 5,
      tech: "NLP Advanced",
    },
  ];

  const stats = [
    { number: "10K+", label: "Entretiens IA", icon: Brain },
    { number: "98%", label: "Précision", icon: Target },
    { number: "75%", label: "Temps économisé", icon: Zap },
    { number: "500+", label: "Entreprises", icon: Star },
  ];

  return (
    <section className="py-32 px-4 bg-gradient-to-b from-slate-900 via-black to-slate-900 relative overflow-hidden">
      {/* Tech background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(147,51,234,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(147,51,234,0.05)_1px,transparent_1px)] bg-[size:100px_100px]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(147,51,234,0.1),transparent_70%)]"></div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Statistics */}
        <div className="text-center mb-20">
          <h2 className="text-6xl md:text-7xl font-extrabold text-white mb-16 leading-none">
            Ils font confiance à
            <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              {" "}
              notre IA
            </span>
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-20">
            {stats.map((stat, index) => {
              const IconComponent = stat.icon;
              return (
                <div key={index} className="text-center group">
                  <div className="mb-4 mx-auto w-16 h-16 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <IconComponent className="w-8 h-8 text-white" />
                  </div>
                  <div className="text-5xl md:text-6xl font-extrabold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent mb-3 group-hover:scale-105 transition-transform duration-300">
                    {stat.number}
                  </div>
                  <div className="text-gray-300 font-bold text-lg">
                    {stat.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Testimonials */}
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="group bg-gradient-to-br from-slate-800/80 to-slate-900/90 backdrop-blur-lg border border-purple-500/30 shadow-2xl hover:shadow-purple-500/40 transition-all duration-700 transform hover:scale-105 hover:-translate-y-2"
            >
              <div className="p-8">
                <div className="flex items-center mb-6">
                  <div className="w-16 h-16 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-2xl mr-4 group-hover:scale-110 transition-transform duration-300">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-lg">
                      {testimonial.name}
                    </h4>
                    <p className="text-gray-300 text-sm">{testimonial.role}</p>
                    <p className="text-cyan-400 font-bold text-sm">
                      {testimonial.company}
                    </p>
                  </div>
                </div>

                <div className="mb-4 inline-block bg-gradient-to-r from-purple-600/20 to-cyan-600/20 backdrop-blur-sm border border-purple-500/30 rounded-full px-3 py-1">
                  <span className="text-xs text-purple-300 font-bold">
                    {testimonial.tech}
                  </span>
                </div>

                <p className="text-gray-300 leading-relaxed italic mb-6 group-hover:text-gray-200 transition-colors duration-300">
                  "{testimonial.content}"
                </p>

                <div className="flex text-yellow-400">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-current" />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
