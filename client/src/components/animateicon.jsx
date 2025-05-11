import { Briefcase } from "lucide-react";
import { motion } from "framer-motion";

const Pg1 = () => {
  return (
    
    <div className="flex items-center justify-center h-screen bg-gray-700">
      
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{
          type: "spring",
          stiffness: 100,
          damping: 10,
          repeat: Infinity,
          repeatType: "reverse",
          duration: 1.5,
        }}
        className="text-center"
      >
        <Briefcase size={50} className="text-blue-400 mx-auto" />
        <h3 className="text-2xl text-blue-400 mt-4">Ace your</h3>
        <h1 className="text-4xl font-bold text-white mt-2">Technical Interviews</h1>
      </motion.div>
    </div>
  );
};

export default Pg1;

