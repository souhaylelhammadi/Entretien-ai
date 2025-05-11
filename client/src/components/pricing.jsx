import React, { useState } from "react";
import { Button } from "reactstrap";
import { Check } from "lucide-react";
import { motion } from "framer-motion";

const Pricing = () => {
  const [activePrice, setActivePrice] = useState("monthly");

  const pricingPlans = [
    {
      title: "Basic",
      monthlyPrice: 9.99,
      yearlyPrice: 99.99,
      features: [
        "10 Practice Interviews",
        "Basic Feedback Report",
        "General Interview Questions",
        "Email Support",
      ],
      recommended: false,
    },
    {
      title: "Professional",
      monthlyPrice: 19.99,
      yearlyPrice: 199.99,
      features: [
        "Unlimited Practice Interviews",
        "Detailed Performance Analysis",
        "Industry-Specific Questions",
        "Real-Time Coaching",
        "Priority Support",
      ],
      recommended: true,
    },
    {
      title: "Enterprise",
      monthlyPrice: 49.99,
      yearlyPrice: 499.99,
      features: [
        "Everything in Professional",
        "Custom Question Library",
        "Team Management Dashboard",
        "API Access",
        "Dedicated Account Manager",
        "Custom Integration",
      ],
      recommended: false,
    },
  ];

  return (
    <div className="bg-gray-50 text-gray-800 py-20">
      <div className="container mx-auto px-4 text-center">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-4xl font-bold mb-6"
        >
          Choose Your Plan
        </motion.h1>

        {/* Pricing Toggle */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex justify-center space-x-4 bg-gray-200 p-2 rounded-full w-64 mx-auto mb-8"
        >
          <button
            className={`py-2 px-4 rounded-full ${
              activePrice === "monthly"
                ? "bg-blue-500 text-white"
                : "text-gray-600"
            }`}
            onClick={() => setActivePrice("monthly")}
          >
            Monthly
          </button>
          <button
            className={`py-2 px-4 rounded-full ${
              activePrice === "yearly"
                ? "bg-blue-500 text-white"
                : "text-gray-600"
            }`}
            onClick={() => setActivePrice("yearly")}
          >
            Yearly (Save 20%)
          </button>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {pricingPlans.map((plan, index) => (
            <motion.div
              key={plan.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.2 }}
              className={`bg-white p-8 rounded-xl shadow-lg border ${
                plan.recommended ? "border-purple-500" : "border-gray-200"
              }`}
            >
              
              <h3 className="text-xl font-semibold mb-4">{plan.title}</h3>
              <div className="text-4xl font-bold mb-4">
                $
                {activePrice === "monthly"
                  ? plan.monthlyPrice
                  : plan.yearlyPrice}
                <span className="text-gray-500 text-lg"> / {activePrice}</span>
              </div>
              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    className="flex items-start text-gray-600"
                  >
                    <Check size={18} className="text-blue-500 mr-2 mt-0.5" />
                    {feature}
                  </motion.li>
                ))}
              </ul>
              <Button className="w-full bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600 transition">
                Get Started
              </Button>
            </motion.div>
          ))}
        </div>

        {/* Guarantee */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-gray-500 mt-12"
        >
          30-day money-back guarantee. No questions asked.
        </motion.p>
      </div>
    </div>
  );
};

export default Pricing;
