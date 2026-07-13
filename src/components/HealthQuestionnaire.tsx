import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  Activity, 
  Wind, 
  Zap, 
  ChevronRight, 
  ChevronLeft,
  X
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

const HealthQuestionnaire = () => {
  const { user, profile, showToast, updateProfileData } = useAuth();
  const [show, setShow] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const questions = [
    "Have you ever had chest pain, especially during walking or exercise?",
    "Do you often feel shortness of breath or unusual tiredness?",
    "Have you ever been diagnosed with a heart condition or heart attack?",
    "Do you have high blood pressure, diabetes, or cholesterol problems?",
    "Do you smoke, or have you smoked in the past?",
    "Does heart disease run in your family, especially at a young age?"
  ];

  useEffect(() => {
    // Show popup after 3 seconds if not already answered
    const timer = setTimeout(() => {
      if (profile && !profile.hasOwnProperty('questionnaireAnswers')) {
        setShow(true);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [profile]);

  const handleAnswer = (answer: string) => {
    setAnswers({ ...answers, [currentStep]: answer });
    if (currentStep < questions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete({ ...answers, [currentStep]: answer });
    }
  };

  const handleComplete = async (finalAnswers: any) => {
    if (!user) return;
    try {
      const patientRef = doc(db, 'patients', user.uid);
      await updateDoc(patientRef, { questionnaireAnswers: finalAnswers });
      await updateProfileData({ questionnaireAnswers: finalAnswers } as any);
      showToast('Responses saved. Our AI is analyzing your data.', 'success');
      setShow(false);
    } catch (err) {
      showToast('Error saving responses', 'error');
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[40px] shadow-2xl border border-slate-200 overflow-hidden relative"
      >
        <button 
          onClick={() => setShow(false)}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-50 text-slate-400 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-accent-maroon/10 rounded-2xl">
              <Zap className="w-6 h-6 text-accent-maroon" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Medical Assistant</p>
              <h3 className="text-xl font-bold text-slate-900">Health Assessment</h3>
            </div>
          </div>

          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Question {currentStep + 1} of {questions.length}</span>
              <div className="flex gap-1">
                {questions.map((_, i) => (
                  <div key={i} className={`h-1 w-4 rounded-full transition-all ${i <= currentStep ? 'bg-accent-maroon' : 'bg-slate-100'}`} />
                ))}
              </div>
            </div>
            
            <AnimatePresence mode="wait">
              <motion.p
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="text-lg font-bold text-slate-900 leading-tight min-h-[3.5rem]"
              >
                {questions[currentStep]}
              </motion.p>
            </AnimatePresence>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => handleAnswer('Yes')}
              className="flex-1 py-4 px-6 bg-accent-maroon text-white font-bold rounded-2xl shadow-lg shadow-accent-maroon/20 hover:scale-[1.02] transition-all"
            >
              Yes
            </button>
            <button
              onClick={() => handleAnswer('No')}
              className="flex-1 py-4 px-6 bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 transition-all"
            >
              No
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default HealthQuestionnaire;
