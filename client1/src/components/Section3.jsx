import React, {
  createContext,
  useState,
  useContext,
  useRef,
  useEffect,
} from "react";
import { cn } from "../lib/utils"; // Supposons que cette utilité existe dans votre projet
import { motion } from "framer-motion";
import { Briefcase, MessageCircle, Brain } from "lucide-react";
import shot4 from "../images/imga/interview.png";
// Variants d'animation pour Framer Motion
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const staggerContainer = {
  visible: { transition: { staggerChildren: 0.2 } },
};

// MouseEnterContext pour la carte 3D
const MouseEnterContext = createContext(undefined);

// CardContainer Component
export const CardContainer = ({ children, className, containerClassName }) => {
  const containerRef = useRef(null);
  const [isMouseEntered, setIsMouseEntered] = useState(false);

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const { left, top, width, height } =
      containerRef.current.getBoundingClientRect();
    const x = (e.clientX - left - width / 2) / 25;
    const y = (e.clientY - top - height / 2) / 25;
    containerRef.current.style.transform = `rotateY(${x}deg) rotateX(${y}deg)`;
  };

  const handleMouseEnter = (e) => {
    setIsMouseEntered(true);
  };

  const handleMouseLeave = (e) => {
    if (!containerRef.current) return;
    setIsMouseEntered(false);
    containerRef.current.style.transform = `rotateY(0deg) rotateX(0deg)`;
  };

  return (
    <MouseEnterContext.Provider value={[isMouseEntered, setIsMouseEntered]}>
      <div
        className={cn(
          "py-20 flex items-center justify-center",
          containerClassName
        )}
        style={{ perspective: "1000px" }}
      >
        <div
          ref={containerRef}
          onMouseEnter={handleMouseEnter}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className={cn(
            "flex items-center justify-center relative transition-all duration-200 ease-linear",
            className
          )}
          style={{ transformStyle: "preserve-3d" }}
        >
          {children}
        </div>
      </div>
    </MouseEnterContext.Provider>
  );
};

// CardBody Component
export const CardBody = ({ children, className }) => {
  return (
    <div
      className={cn(
        "h-96 w-96 [transform-style:preserve-3d] [&>*]:[transform-style:preserve-3d]",
        className
      )}
    >
      {children}
    </div>
  );
};

// CardItem Component
export const CardItem = ({
  as = "div",
  children,
  className,
  translateX = 0,
  translateY = 0,
  translateZ = 0,
  rotateX = 0,
  rotateY = 0,
  rotateZ = 0,
  ...rest
}) => {
  const ref = useRef(null);
  const [isMouseEntered] = useMouseEnter();

  useEffect(() => {
    handleAnimations();
  }, [isMouseEntered]);

  const handleAnimations = () => {
    if (!ref.current) return;
    if (isMouseEntered) {
      ref.current.style.transform = `translateX(${translateX}px) translateY(${translateY}px) translateZ(${translateZ}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg)`;
    } else {
      ref.current.style.transform = `translateX(0px) translateY(0px) translateZ(0px) rotateX(0deg) rotateY(0deg) rotateZ(0deg)`;
    }
  };

  const Tag = as;
  return (
    <Tag
      ref={ref}
      className={cn("w-fit transition duration-200 ease-linear", className)}
      {...rest}
    >
      {children}
    </Tag>
  );
};

// Hook pour utiliser MouseEnterContext
export const useMouseEnter = () => {
  const context = useContext(MouseEnterContext);
  if (context === undefined) {
    throw new Error(
      "useMouseEnter doit être utilisé à l'intérieur d'un MouseEnterProvider"
    );
  }
  return context;
};

// ThreeDCardDemo Component
export function ThreeDCardDemo() {
  return (
    <CardContainer className="inter-var">
      <CardBody className="bg-gray-50 relative group/card dark:hover:shadow-2xl dark:hover:shadow-emerald-500/[0.1] dark:bg-[#111630] dark:border-white/[0.2] border-black/[0.1] w-auto sm:w-[30rem] h-auto rounded-xl p-6 border">
        <CardItem
          translateZ="50"
          className="text-xl font-bold text-neutral-600 dark:text-white"
        >
          Maîtrisez vos entretiens techniques avec des retours en temps réel et
          du coaching IA
        </CardItem>
        <CardItem
          as="p"
          translateZ="60"
          className="text-neutral-500 text-sm max-w-sm mt-2 dark:text-neutral-300"
        >
          Rejoignez des milliers de développeurs juniors, commencez à passer des
          entretiens avec confiance dès aujourd'hui.
        </CardItem>
        <CardItem
          translateZ="100"
          rotateX={20}
          rotateZ={-10}
          className="w-full mt-4"
        >
          <img
            src={""}
            className="h-60 w-full object-cover rounded-xl group-hover/card:shadow-xl"
            alt="thumbnail"
          />
        </CardItem>
        <div className="flex justify-between items-center mt-20">
          <CardItem
            translateZ={20}
            translateX={-40}
            as="button"
            className="px-4 py-2 rounded-xl text-xs font-normal dark:text-white"
          >
            Essayez maintenant →
          </CardItem>
        </div>
      </CardBody>
    </CardContainer>
  );
}

// InterviewPrepSection Component (Export principal)
const InterviewPrepSection = () => {
  return (
    <div className="bg-white text-gray-800 min-h-screen animate-on-scroll">
      <div className="container mx-auto px-4 py-12 grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Section Démo Carte 3D */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          variants={fadeInUp}
          viewport={{ once: true, amount: 0.2 }}
          className="flex items-center justify-center"
        >
          <ThreeDCardDemo />
        </motion.div>

        {/* Section Préparation à l'entretien assistée par IA */}
        <div className="flex flex-col justify-center">
          <motion.h2
            initial="hidden"
            whileInView="visible"
            variants={fadeInUp}
            viewport={{ once: true, amount: 0.2 }}
            className="text-4xl font-bold mb-4"
          >
            Préparation à l'entretien assistée par IA
          </motion.h2>

          <motion.p
            initial="hidden"
            whileInView="visible"
            variants={fadeInUp}
            transition={{ delay: 0.2 }}
            viewport={{ once: true, amount: 0.2 }}
            className="text-gray-600 mb-8"
          >
            Entraînez-vous avec une IA qui pense comme un intervieweur senior.
            Recevez des questions spécifiques au rôle et des retours d'experts
            similaires à ceux des vrais entretiens techniques dans les
            entreprises de type FAANG.
          </motion.p>

          <motion.div
            initial="hidden"
            whileInView="visible"
            variants={staggerContainer}
            viewport={{ once: true, amount: 0.2 }}
            className="space-y-8"
          >
            {[
              {
                icon: <Briefcase className="text-blue-500 mt-1" size={24} />,
                title: "Formation spécifique à l'industrie",
                description:
                  "Des questions adaptées pour le développement logiciel, la data science, la gestion de produit, et bien plus.",
              },
              {
                icon: (
                  <MessageCircle className="text-blue-500 mt-1" size={24} />
                ),
                title: "Analyse des performances en temps réel",
                description:
                  "Recevez un retour immédiat sur la précision technique, la clarté de la communication et la confiance dans la présentation.",
              },
              {
                icon: <Brain className="text-blue-500 mt-1" size={24} />,
                title: "Préparation au niveau FAANG",
                description:
                  "Entraînez-vous avec des questions issues des véritables entretiens dans les entreprises technologiques de premier plan.",
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="flex items-start space-x-4"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
              >
                <motion.div
                  whileHover={{ scale: 1.2, rotate: 10 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  {item.icon}
                </motion.div>
                <div>
                  <motion.h3
                    initial="hidden"
                    whileInView="visible"
                    variants={fadeInUp}
                    className="text-xl font-semibold mb-1"
                  >
                    {item.title}
                  </motion.h3>
                  <motion.p
                    initial="hidden"
                    whileInView="visible"
                    variants={fadeInUp}
                    className="text-gray-600"
                  >
                    {item.description}
                  </motion.p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            variants={fadeInUp}
            viewport={{ once: true, amount: 0.2 }}
            className="mt-8"
          >
            {/* Ajouter du contenu ou des boutons supplémentaires si nécessaire */}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default InterviewPrepSection;
